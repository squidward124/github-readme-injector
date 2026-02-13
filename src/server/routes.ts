import { Router, Request, Response } from 'express';
import { getGitHubCLI } from '../github/cli';
import { getGenerator, DEFAULT_SYSTEM_PROMPT } from '../generator';
import { wsManager } from './websocket';
import { SessionConfig, GeneratedRepo, Session } from '../types';

const router = Router();

// State
let currentSession: Session | null = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateRepoName(prefix: string, iteration: number): string {
  const rand = Math.random().toString(36).substr(2, 6);
  return `${prefix}-${iteration}-${rand}`;
}

// ============ Status ============

router.get('/status', async (_req: Request, res: Response) => {
  const cli = getGitHubCLI();
  const auth = await cli.checkAuth();
  res.json({
    ghAuth: auth,
    session: currentSession,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT
  });
});

// ============ Auth Check ============

router.get('/check-auth', async (_req: Request, res: Response) => {
  const cli = getGitHubCLI();
  const auth = await cli.checkAuth();
  res.json(auth);
});

// ============ System Prompt ============

router.get('/system-prompt', (_req: Request, res: Response) => {
  res.json({ defaultPrompt: DEFAULT_SYSTEM_PROMPT });
});

// ============ Run ============

router.post('/run', async (req: Request, res: Response) => {
  const {
    apiKey,
    model,
    behaviorGoal,
    exampleExploits,
    systemPrompt,
    repoPrefix,
    iterations
  } = req.body as SessionConfig;

  // Validate
  if (!apiKey) return res.status(400).json({ error: 'API key is required' });
  if (!behaviorGoal) return res.status(400).json({ error: 'Behavior goal is required' });
  if (!iterations || iterations < 1) return res.status(400).json({ error: 'Iterations must be >= 1' });

  // Check gh auth
  const cli = getGitHubCLI();
  const auth = await cli.checkAuth();
  if (!auth.authenticated) {
    return res.status(400).json({ error: 'gh CLI not authenticated. Run: gh auth login' });
  }

  // Configure generator
  const generator = getGenerator();
  generator.configure(apiKey, model || 'x-ai/grok-4-fast', behaviorGoal, exampleExploits || '', systemPrompt || undefined);

  // Create session
  currentSession = {
    id: generateId(),
    config: {
      apiKey: '***',
      model: model || 'x-ai/grok-4-fast',
      behaviorGoal,
      exampleExploits: exampleExploits || '',
      systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
      repoPrefix: repoPrefix || 'sec-research',
      iterations
    },
    status: 'running',
    repos: [],
    currentIteration: 0,
    startTime: new Date()
  };

  cli.resetFlags();

  // Send initial response
  res.json({
    success: true,
    sessionId: currentSession.id,
    totalIterations: iterations
  });

  // Run async loop
  const prefix = repoPrefix || 'sec-research';

  (async () => {
    wsManager.sendStatus('running');

    for (let i = 0; i < iterations; i++) {
      // Check for abort
      if (cli.isAbortedFlag()) {
        wsManager.sendStatus('done', { reason: 'aborted' });
        break;
      }

      // Check for pause
      if (cli.isPausedFlag()) {
        wsManager.sendStatus('paused', { currentIteration: i + 1 });
        while (cli.isPausedFlag() && !cli.isAbortedFlag()) {
          await new Promise(r => setTimeout(r, 500));
        }
        if (cli.isAbortedFlag()) {
          wsManager.sendStatus('done', { reason: 'aborted' });
          break;
        }
        wsManager.sendStatus('running');
      }

      currentSession!.currentIteration = i;
      const repoName = generateRepoName(prefix, i + 1);

      const repo: GeneratedRepo = {
        id: generateId(),
        iterationNumber: i + 1,
        repoName,
        readmeContent: '',
        technique: '',
        reasoning: '',
        repoUrl: null,
        status: 'generating'
      };

      currentSession!.repos.push(repo);

      // Step 1: Generate README content via LLM
      wsManager.broadcast('generation_start', { iteration: i + 1, total: iterations, repoName });
      wsManager.sendLog(`[${i + 1}/${iterations}] Generating README for ${repoName}...`);

      try {
        const previousAttempts = currentSession!.repos
          .filter(r => r.status === 'created' || r.status === 'error')
          .map(r => ({ technique: r.technique, reasoning: r.reasoning }));

        const result = await generator.generate(i + 1, previousAttempts);

        repo.readmeContent = result.readmeContent;
        repo.technique = result.technique;
        repo.reasoning = result.reasoning;

        wsManager.broadcast('generation_complete', {
          iteration: i + 1,
          technique: result.technique,
          reasoning: result.reasoning,
          projectTheme: result.projectTheme,
          readmeLength: result.readmeContent.length
        });
        wsManager.sendLog(`[${i + 1}/${iterations}] Generated: technique="${result.technique}", theme="${result.projectTheme}"`);

        // Step 2: Create repo on GitHub via gh CLI
        repo.status = 'creating';
        wsManager.broadcast('repo_creating', { iteration: i + 1, repoName });
        wsManager.sendLog(`[${i + 1}/${iterations}] Creating repo ${repoName} via gh CLI...`);

        const repoUrl = await cli.createRepoWithReadme(
          repoName,
          result.projectTheme || 'test project',
          result.readmeContent
        );

        repo.repoUrl = repoUrl;
        repo.status = 'created';
        repo.createdAt = new Date();

        wsManager.broadcast('repo_created', {
          iteration: i + 1,
          repoName,
          repoUrl,
          technique: result.technique
        });
        wsManager.sendLog(`[${i + 1}/${iterations}] Repo created: ${repoUrl}`);

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        repo.status = 'error';
        repo.error = msg;

        wsManager.broadcast('repo_error', { iteration: i + 1, repoName, error: msg });
        wsManager.sendLog(`[${i + 1}/${iterations}] ERROR: ${msg}`);
      }

      // Pause between iterations
      if (i < iterations - 1 && !cli.shouldStop()) {
        wsManager.sendLog(`Waiting 3s before next iteration...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Session complete
    if (currentSession) {
      currentSession.endTime = new Date();
      currentSession.status = 'done';
    }

    const created = currentSession?.repos.filter(r => r.status === 'created').length || 0;
    const errors = currentSession?.repos.filter(r => r.status === 'error').length || 0;

    wsManager.broadcast('session_complete', {
      totalCreated: created,
      totalErrors: errors,
      repos: currentSession?.repos.map(r => ({
        name: r.repoName,
        url: r.repoUrl,
        technique: r.technique,
        status: r.status
      }))
    });
    wsManager.sendStatus('done');
    wsManager.sendLog(`Session complete. Created: ${created}, Errors: ${errors}`);
  })();
});

// ============ Controls ============

router.post('/pause', (_req: Request, res: Response) => {
  getGitHubCLI().pause();
  wsManager.sendStatus('paused');
  res.json({ success: true });
});

router.post('/resume', (_req: Request, res: Response) => {
  getGitHubCLI().resume();
  wsManager.sendStatus('running');
  res.json({ success: true });
});

router.post('/abort', (_req: Request, res: Response) => {
  getGitHubCLI().abort();
  wsManager.sendStatus('done', { reason: 'aborted' });
  res.json({ success: true });
});

// ============ Results ============

router.get('/results', (_req: Request, res: Response) => {
  res.json({ session: currentSession });
});

router.get('/results/export', (_req: Request, res: Response) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    session: currentSession
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=readme-injector-results-${Date.now()}.json`);
  res.json(exportData);
});

export default router;

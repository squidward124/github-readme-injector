// GitHub CLI wrapper - creates repos with READMEs using gh + git commands

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';

export class GitHubCLI extends EventEmitter {
  private _isPaused = false;
  private _isAborted = false;
  private ghUser: string = '';

  async checkAuth(): Promise<{ authenticated: boolean; username: string; error?: string }> {
    try {
      this.exec('gh auth status');
      const username = this.exec('gh api user --jq ".login"').trim();
      this.ghUser = username;
      return { authenticated: true, username };
    } catch (e: any) {
      const msg = e.stderr || e.message || 'gh CLI not found or not authenticated';
      return { authenticated: false, username: '', error: String(msg).trim() };
    }
  }

  getUsername(): string {
    return this.ghUser;
  }

  async createRepoWithReadme(repoName: string, description: string, readmeContent: string): Promise<string> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-readme-'));

    try {
      // Write the README file
      fs.writeFileSync(path.join(tmpDir, 'README.md'), readmeContent, 'utf-8');

      // Git init with main branch
      this.exec('git init -b main', tmpDir);
      this.exec('git config user.email "readme-injector@localhost"', tmpDir);
      this.exec('git config user.name "README Injector"', tmpDir);
      this.exec('git add README.md', tmpDir);
      this.exec('git commit -m "Initial commit"', tmpDir);

      // Create the repo on GitHub and push in one step
      const safeDesc = description.replace(/"/g, '\\"').replace(/`/g, '');
      this.exec(
        `gh repo create "${repoName}" --public -d "${safeDesc}" --source=. --push`,
        tmpDir
      );

      // Build the URL
      const owner = this.ghUser || this.exec('gh api user --jq ".login"').trim();
      return `https://github.com/${owner}/${repoName}`;

    } finally {
      // Always clean up the temp directory
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  private exec(cmd: string, cwd?: string): string {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
    });
  }

  // Pause / resume / abort flags
  pause(): void { this._isPaused = true; }
  resume(): void { this._isPaused = false; }
  abort(): void { this._isAborted = true; this._isPaused = false; }
  resetFlags(): void { this._isPaused = false; this._isAborted = false; }
  isPausedFlag(): boolean { return this._isPaused; }
  isAbortedFlag(): boolean { return this._isAborted; }
  shouldStop(): boolean { return this._isPaused || this._isAborted; }
}

let instance: GitHubCLI | null = null;
export function getGitHubCLI(): GitHubCLI {
  if (!instance) instance = new GitHubCLI();
  return instance;
}

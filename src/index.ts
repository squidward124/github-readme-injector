import { createApp } from './server/app';

const PORT = process.env.PORT || 3001;

async function main() {
  console.log('Starting GitHub README Injector...');

  const { server } = createApp();

  server.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  GitHub README Injector is running!`);
    console.log(`${'='.repeat(50)}`);
    console.log(`\n  Dashboard: http://localhost:${PORT}`);
    console.log(`  Using: gh CLI (no browser needed)`);
    console.log(`\n  Press Ctrl+C to stop\n`);
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

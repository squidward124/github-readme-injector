# GitHub README Injector

A security research tool for testing indirect prompt injection vulnerabilities in AI systems. This tool generates GitHub repositories with README files containing hidden prompt injection payloads to study how AI assistants parse and respond to repository documentation.

## ⚠️ Disclaimer

This tool is designed for **authorized security research and educational purposes only**. It should be used to:
- Test your own AI systems for prompt injection vulnerabilities
- Conduct authorized security assessments
- Participate in bug bounty programs with appropriate permissions
- Educational demonstrations in controlled environments

**Do NOT use this tool to:**
- Attack systems you don't own or have explicit permission to test
- Create malicious repositories intended to harm other users
- Violate GitHub's terms of service or any other platform's policies

## 🎯 Purpose

This tool helps security researchers understand and test:
- How AI assistants process repository documentation
- Effectiveness of various prompt injection techniques
- Detection capabilities of AI safety systems
- Mitigation strategies for indirect prompt attacks

## ✨ Features

- **LLM-Powered Generation**: Uses OpenRouter API to generate diverse injection payloads
- **Multiple Techniques**: Tests various injection methods (HTML comments, markdown abuse, encoding tricks, etc.)
- **Web Dashboard**: Intuitive UI for configuring and monitoring injection campaigns
- **GitHub Integration**: Automated repository creation via GitHub CLI
- **Real-time Progress**: Live logging and progress tracking
- **Export Results**: JSON export of all generated payloads and techniques

## 📋 Prerequisites

### Required
- **Node.js** (v18 or higher)
- **GitHub CLI** (`gh`) - [Installation guide](https://cli.github.com/)
- **OpenRouter API Key** - [Get one here](https://openrouter.ai/)

### Platform Support
- ✅ Windows
- ✅ macOS
- ✅ Linux

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/github-readme-injector.git
   cd github-readme-injector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Authenticate with GitHub CLI**
   ```bash
   gh auth login
   ```
   Follow the prompts to authenticate with your GitHub account.

4. **Build the project**
   ```bash
   npm run build
   ```

## 🎮 Usage

1. **Start the server**
   ```bash
   npm start
   ```

2. **Open the dashboard**
   Navigate to `http://localhost:3001` in your browser

3. **Configure your session**
   - **API Key**: Enter your OpenRouter API key
   - **Model**: Select an LLM model (Grok 4 Fast recommended)
   - **Target Behavior**: Describe what behavior the injection should trigger
   - **Repo Prefix**: Prefix for generated repository names
   - **Iterations**: Number of repos to generate

4. **Advanced Options** (optional)
   - **Example Exploits**: Paste working injection examples for the LLM to study
   - **System Prompt**: Customize the generation instructions

5. **Start the session**
   Click "Start Session" and watch as repositories are generated and created

## 🛠️ Development

### Build the project
```bash
npm run build
```

### Development mode (with auto-rebuild)
```bash
npm run dev
```

### Project Structure
```
github-readme-injector/
├── src/
│   ├── index.ts              # Application entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── server/
│   │   ├── app.ts           # Express server setup
│   │   ├── routes.ts        # API routes
│   │   └── websocket.ts     # WebSocket server
│   ├── github/
│   │   └── cli.ts           # GitHub CLI wrapper
│   └── generator/
│       └── index.ts         # LLM-based README generator
├── public/
│   ├── index.html           # Web dashboard
│   ├── css/style.css        # Styles
│   └── js/app.js            # Frontend logic
└── dist/                    # Compiled JavaScript output
```

## 🔍 How It Works

1. **Configuration**: User specifies target behavior and injection parameters
2. **Generation**: LLM generates README content with hidden injection payloads
3. **Variation**: Each iteration uses a different technique and project theme
4. **Creation**: GitHub CLI creates a new public repository
5. **Deployment**: README is committed and pushed to the repository
6. **Logging**: All techniques and results are logged for analysis

## 🎨 Injection Techniques

The tool tests various prompt injection methods:
- **Invisible text**: HTML comments, zero-width characters, hidden divs
- **Markdown abuse**: Comments, HTML blocks, image alt text
- **Authority spoofing**: System-level directive mimicry
- **Context manipulation**: Framing as "AI assistant notes"
- **Encoding tricks**: Unicode lookalikes, obfuscation
- **Multi-layer hiding**: Combining legitimate content with hidden payloads
- **Semantic camouflage**: Blending into technical documentation

## 🧪 Testing Your AI Systems

After generating test repositories, you can:
1. Ask your AI assistant to analyze or summarize the repositories
2. Monitor for unintended behaviors specified in your target behavior
3. Test different AI systems (ChatGPT, Claude, Copilot, etc.)
4. Document which techniques are most effective
5. Develop and test mitigation strategies

## 📊 Exporting Results

Click "Export JSON" to download a comprehensive report including:
- All generated README content
- Injection techniques used
- Reasoning behind each technique
- Repository URLs
- Timestamps and metadata

## 🤝 Contributing

This is a security research tool. If you discover new injection techniques or improvements:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear documentation

## 📜 License

This project is provided for educational and authorized security research purposes. Users are responsible for ensuring their use complies with all applicable laws and terms of service.

## 🔗 Resources

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Injection Research](https://simonwillison.net/series/prompt-injection/)

## 🙏 Acknowledgments

Built for security researchers studying indirect prompt injection vulnerabilities in AI systems.

---

**Remember**: Always conduct security research ethically and with proper authorization.

# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of llm-benchmark seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@llm-benchmark.dev (or create a security advisory on GitHub).

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

## Preferred Languages

We prefer all communications to be in English.

## Policy

We follow the principle of Coordinated Vulnerability Disclosure.

## Security Best Practices

When using llm-benchmark:

1. **API Keys**: Never commit API keys to version control. Always use environment variables or secure key management systems.

2. **Generated Code**: Always review and test generated code before using it in production. LLMs can occasionally generate code with security vulnerabilities.

3. **Dependencies**: Keep all dependencies up to date. Run `npm audit` or `pnpm audit` regularly.

4. **File System Access**: Be cautious when running benchmarks on untrusted code, as the tool executes code during validation and benchmarking.

5. **Network Security**: When using cloud-based LLM providers, ensure you're on a secure network and using HTTPS connections.

## Security Features

llm-benchmark includes several security features:

- Sandboxed execution for validation and benchmarking (when possible)
- No automatic code execution without explicit user action
- Clear separation between generated variants and original code
- Support for `.env` files to keep API keys out of code

## Contact

For security concerns, please email: security@llm-benchmark.dev

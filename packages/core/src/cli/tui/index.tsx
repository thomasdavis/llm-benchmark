import figures from 'figures';
import gradient from 'gradient-string';
import { render, Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import React, { useState, useEffect } from 'react';

import type { BenchmarkResults } from '../../types/benchmark.js';
import type { Config } from '../../types/config.js';

interface ProviderStatus {
  provider: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  message?: string;
}

interface TUIProps {
  config: Config;
  functionName: string;
}

/**
 * Terminal UI component
 */
const TUIComponent: React.FC<TUIProps & {
  onExit: () => void;
  providerStatuses: Map<string, ProviderStatus>;
  results?: BenchmarkResults;
}> = ({ config, functionName, onExit, providerStatuses, results }) => {
  const { exit } = useApp();
  const [showHelp, setShowHelp] = useState(false);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      onExit();
      exit();
    } else if (input === 'h') {
      setShowHelp(!showHelp);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text>
          {gradient.rainbow.multiline(
            '╔═╗  ╔═╗  ╔╗╔╗  ╔══╗ ╔═══╗╔═╗ ╔╗╔═══╗╦ ╦╔╗╔╗╔═══╗╔═══╗╦╔═\n' +
            '║ ║  ║ ║  ║║║║  ║╔╗║ ║╔══╝║ ╚╗║║║╔═╗║║ ║║║║║║╔═╗║║╔═╗║║║╔╝\n' +
            '║ ╚╗╔╝ ║  ║║║║  ║╚╝╚╗║╚══╗║╔╗╚╝║║║ ╚╝║╚═╝║║║║║╔═╗║║╚═╝║║╚╝\n' +
            '║╔╗╚╝╔╗║  ║║║║  ║╔═╗║║╔══╝║║╚╗ ║║║ ╔╗║╔═╗║║║║║║ ║║║╔╗╔╝║╔╗\n' +
            '║║╚╗╔╝║║  ╚╝╚╝  ║╚═╝║║╚══╗║║ ║ ║║╚═╝║║║ ║║╚╝║║╚═╝║║║║╚╗║║╚╗\n' +
            '╚╝ ╚╝ ╚╝  ╚╝╚╝  ╚═══╝╚═══╝╚╝ ╚═╝╚═══╝╚╝ ╚╝╚═╝╚═══╝╚╝╚═╝╚╝ ╚╝'
          )}
        </Text>
      </Box>

      {/* Function info */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Optimizing: {functionName}
        </Text>
      </Box>

      {/* Provider status */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow" bold>
          {figures.pointerSmall} Generating Variants
        </Text>
        {Array.from(providerStatuses.values()).map((status) => (
          <Box key={status.provider} marginLeft={2}>
            <Box width={20}>
              <Text color="dim">{status.provider}</Text>
            </Box>
            <Box>
              {status.status === 'generating' && (
                <>
                  <Text color="blue">
                    <Spinner type="dots" />
                  </Text>
                  <Text color="blue"> Generating...</Text>
                </>
              )}
              {status.status === 'completed' && (
                <Text color="green">{figures.tick} Completed</Text>
              )}
              {status.status === 'failed' && (
                <Text color="red">{figures.cross} Failed</Text>
              )}
              {status.status === 'pending' && (
                <Text color="dim">{figures.ellipsis} Pending</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Results table */}
      {results && results.variants.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>
            {figures.pointerSmall} Benchmark Results
          </Text>
          <Box marginTop={1} flexDirection="column">
            {results.variants
              .filter(v => v.valid && v.benchmark)
              .map((v, i) => (
                <Box key={i}>
                  <Text>
                    {i === 0 ? '🔥' : `${i + 1}`.padEnd(2)} 
                    {` ${v.provider}:${v.model}`.padEnd(30)} 
                    {` ${v.benchmark?.opsPerSec.toFixed(0) || '-'}`.padEnd(10)} ops/s
                    {v.benchmark?.improvement 
                      ? ` +${v.benchmark.improvement.toFixed(1)}%`.padEnd(10)
                      : ' baseline'.padEnd(10)}
                    {` $${v.generation.costUsd.toFixed(4)}`}
                  </Text>
                </Box>
              ))}
          </Box>
        </Box>
      )}

      {/* Summary */}
      {results && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="green" padding={1}>
          <Text color="green" bold>
            ✅ Benchmark Complete!
          </Text>
          <Text color="dim">
            Total variants: {results.summary.totalVariants} | 
            Valid: {results.summary.validVariants} | 
            Cost: ${results.summary.totalCostUsd.toFixed(4)}
          </Text>
          {results.summary.fastestVariant && (
            <Text>
              Fastest: <Text color="cyan">{results.summary.fastestVariant}</Text>
              {results.summary.maxImprovement && (
                <Text color="green"> (+{results.summary.maxImprovement.toFixed(1)}%)</Text>
              )}
            </Text>
          )}
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text color="dim">
          Press <Text color="cyan">q</Text> to quit
          {showHelp ? ' | ' : ', '}
          <Text color="cyan">h</Text> for help
        </Text>
      </Box>

      {showHelp && (
        <Box marginTop={1} borderStyle="single" borderColor="dim" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow">Keyboard Shortcuts:</Text>
            <Text color="dim">  q, Ctrl+C - Quit</Text>
            <Text color="dim">  h - Toggle help</Text>
            <Text color="dim">  p - Pause/Resume (during generation)</Text>
            <Text color="dim">  v - Toggle verbose output</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * TUI wrapper class
 */
export class TUI {
  private app: any;
  private providerStatuses: Map<string, ProviderStatus> = new Map();
  private results?: BenchmarkResults;
  private exitPromise: Promise<void>;
  private exitResolve?: () => void;

  constructor(
    private config: Config,
    private functionName: string
  ) {
    // Initialize provider statuses
    for (const provider of config.providers) {
      this.providerStatuses.set(provider, {
        provider,
        status: 'pending',
      });
    }

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;
    });
  }

  /**
   * Start the TUI
   */
  async start(): Promise<void> {
    this.app = render(
      <TUIComponent
        config={this.config}
        functionName={this.functionName}
        onExit={() => this.exitResolve?.()}
        providerStatuses={this.providerStatuses}
        results={this.results}
      />
    );
  }

  /**
   * Update provider status
   */
  updateProviderStatus(provider: string, status: string): void {
    const currentStatus = this.providerStatuses.get(provider);
    if (currentStatus) {
      currentStatus.status = status as any;
      this.refresh();
    }
  }

  /**
   * Show results
   */
  showResults(results: BenchmarkResults): void {
    this.results = results;
    this.refresh();
  }

  /**
   * Refresh the UI
   */
  private refresh(): void {
    if (this.app) {
      this.app.rerender(
        <TUIComponent
          config={this.config}
          functionName={this.functionName}
          onExit={() => this.exitResolve?.()}
          providerStatuses={this.providerStatuses}
          results={this.results}
        />
      );
    }
  }

  /**
   * Wait for exit
   */
  async waitForExit(): Promise<void> {
    return this.exitPromise;
  }

  /**
   * Clear the TUI
   */
  clear(): void {
    if (this.app) {
      this.app.unmount();
    }
  }
}
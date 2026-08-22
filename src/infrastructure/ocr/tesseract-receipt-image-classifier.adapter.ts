import { spawn } from 'node:child_process';

import { Inject, Injectable } from '@nestjs/common';

import {
  ReceiptImageClassification,
  ReceiptImageClassifierPort,
} from '@domain/deposits/ports/receipt-image-classifier.port';
import { classifyReceiptText } from '@domain/deposits/services/receipt-text-classifier';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';

const OCR_TIMEOUT_MS = 8_000;

@Injectable()
export class TesseractReceiptImageClassifierAdapter
  implements ReceiptImageClassifierPort
{
  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  async classify(input: {
    bytes: Buffer;
    mimeType: string;
  }): Promise<ReceiptImageClassification> {
    try {
      return classifyReceiptText(await this.extractText(input.bytes));
    } catch (error) {
      this.logger.warn(
        `Receipt OCR unavailable: ${error instanceof Error ? error.message : String(error)}`,
        TesseractReceiptImageClassifierAdapter.name,
      );
      return ReceiptImageClassification.UNKNOWN;
    }
  }

  private extractText(bytes: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('tesseract', ['stdin', 'stdout', '-l', 'spa'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        process.kill('SIGKILL');
        reject(new Error('OCR timed out'));
      }, OCR_TIMEOUT_MS);

      process.stdout.setEncoding('utf8');
      process.stderr.setEncoding('utf8');
      process.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      process.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      process.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      process.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
          return;
        }
        reject(
          new Error(`OCR exited with code ${code}: ${stderr.slice(0, 200)}`),
        );
      });
      process.stdin.on('error', () => undefined);
      process.stdin.end(bytes);
    });
  }
}

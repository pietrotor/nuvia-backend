import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptService {
  private readonly saltRounds = 10;

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.saltRounds);
  }

  hashSync(plainText: string): string {
    return bcrypt.hashSync(plainText, this.saltRounds);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }

  compareSync(plainText: string, hash: string): boolean {
    return bcrypt.compareSync(plainText, hash);
  }
}

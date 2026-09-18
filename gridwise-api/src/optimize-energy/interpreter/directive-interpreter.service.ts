import { Injectable } from '@nestjs/common';

import {
  InterpretedDirective,
} from './directive-interpreter.types.js';

@Injectable()
export class DirectiveInterpreterService {
  interpret(
    note: string,
    noteIndex: number,
  ): InterpretedDirective {
    return {
      note_index: noteIndex,
      applies: false,
      directive_type: 'no_op',
      structured_adjustment: null,
      explanation: `No directive interpreted yet for note: ${note}`,
    };
  }
}
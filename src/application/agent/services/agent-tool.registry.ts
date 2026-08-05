import { Inject, Injectable } from '@nestjs/common';

import { AgentTool, AGENT_TOOLS } from '../tools/agent-tool';

@Injectable()
export class AgentToolRegistry {
  private readonly toolsByName: Map<string, AgentTool>;

  constructor(@Inject(AGENT_TOOLS) tools: AgentTool[]) {
    this.toolsByName = new Map(
      tools.map((tool) => [tool.definition.name, tool]),
    );
  }

  definitions() {
    return [...this.toolsByName.values()].map((tool) => tool.definition);
  }

  get(name: string): AgentTool | undefined {
    return this.toolsByName.get(name);
  }
}

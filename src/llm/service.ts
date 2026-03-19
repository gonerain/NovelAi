import { defaultTaskRoutes } from "./config.js";
import { DefaultClientRegistry, type ClientRegistry } from "./registry.js";
import type {
  ChatMessage,
  GenerateTextResult,
  StructuredGenerationResult,
  TaskName,
} from "./types.js";

interface GenerateForTaskArgs {
  task: TaskName;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface GenerateObjectForTaskArgs<TSchema extends object>
  extends GenerateForTaskArgs {
  schema: TSchema;
}

export class LlmService {
  constructor(
    private readonly registry: ClientRegistry = new DefaultClientRegistry(),
  ) {}

  async generateForTask(args: GenerateForTaskArgs): Promise<GenerateTextResult> {
    const route = defaultTaskRoutes[args.task];
    const client = this.registry.get(route.provider);

    return client.generateText({
      messages: args.messages,
      options: {
        model: route.model,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
      },
    });
  }

  async generateObjectForTask<TObject extends object>(
    args: GenerateObjectForTaskArgs<TObject>,
  ): Promise<StructuredGenerationResult<TObject>> {
    const route = defaultTaskRoutes[args.task];
    const client = this.registry.get(route.provider);

    return client.generateObject<TObject>({
      messages: args.messages,
      schema: args.schema,
      options: {
        model: route.model,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
      },
    });
  }
}

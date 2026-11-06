import { Check, Copy, ExternalLink, Server, Zap } from "lucide-react";
import { useState } from "react";

function CodeBlock({ code, lang = "java" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl border border-white/[0.07] bg-[#09111b] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-300 transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-xs text-slate-300 overflow-x-auto leading-6 whitespace-pre">{code}</pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-cyan-300/10 border border-cyan-300/20 flex items-center justify-center text-xs font-semibold text-cyan-300 mt-0.5">
        {n}
      </div>
      <div className="flex-1 space-y-3">
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        {children}
      </div>
    </div>
  );
}

const DEPENDENCY_XML = `<dependency>
  <groupId>com.example</groupId>
  <artifactId>llm-observability-spring-aop</artifactId>
  <version>1.0.0</version>
</dependency>`;

const ANNOTATION_JAVA = `import com.example.observability.LlmObserved;

@Service
public class RagService {

    @LlmObserved(
        service = "hallucination-rag",
        endpoint = "/api/rag/answer",
        provider = "groq",
        model = "openai/gpt-oss-120b"
    )
    public RagAnswer answer(RagRequest request) {
        // Your existing Groq client call — no changes needed here.
        return groqClient.complete(request.prompt());
    }
}`;

const ASPECT_JAVA = `@Aspect
@Component
public class GroqObservabilityAspect {

    @Around("@annotation(LlmObserved)")
    public Object observe(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed();
            long latency = System.currentTimeMillis() - start;
            logger.record(/* prompt, response, latency, tokens, status=success */);
            return result;
        } catch (Throwable ex) {
            long latency = System.currentTimeMillis() - start;
            logger.record(/* prompt, null, latency, 0, status=error, message */);
            throw ex;
        }
    }
}`;

const ENV_SNIPPET = `# .env (server)
GROQ_API_KEY=gsk_...

# Optional MySQL persistence
DATABASE_URL=mysql://user:pass@localhost:3306/llm_observability`;

export default function Integrations() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-1">
          <Server className="h-3.5 w-3.5" /> Integrations
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Connect your services</h1>
        <p className="text-xs text-slate-500 mt-1">
          Add one annotation to any Groq-compatible method and every completion appears here automatically.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 flex items-start gap-3">
        <Zap className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-emerald-200">Live pipeline active</p>
          <p className="mt-0.5 text-xs text-slate-500">
            The RAG demo on the Overview page is already wired in. Calls from it appear in Traces within seconds.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-8">
        <Step n={1} title="Add the Maven dependency to your Spring Boot project">
          <CodeBlock code={DEPENDENCY_XML} lang="xml" />
          <p className="text-xs text-slate-500">
            The module lives in{" "}
            <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">
              observability/spring-aop/
            </code>{" "}
            in this repo. Build it with{" "}
            <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">
              cd observability/spring-aop &amp;&amp; mvn install
            </code>.
          </p>
        </Step>

        <Step n={2} title="Annotate the method that calls your LLM">
          <CodeBlock code={ANNOTATION_JAVA} lang="java" />
          <p className="text-xs text-slate-500">
            The aspect intercepts the method call, measures wall-clock latency, serialises the
            arguments and return value, and delegates to{" "}
            <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">
              LlmCallLogger
            </code>. No other changes needed in your service.
          </p>
        </Step>

        <Step n={3} title="How the aspect works (reference)">
          <CodeBlock code={ASPECT_JAVA} lang="java" />
        </Step>

        <Step n={4} title="Configure environment variables">
          <CodeBlock code={ENV_SNIPPET} lang="bash" />
          <p className="text-xs text-slate-500">
            Without{" "}
            <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">
              DATABASE_URL
            </code>{" "}
            the dashboard falls back to an in-memory store so the UI still works during local
            development.
          </p>
        </Step>

        <Step n={5} title="Verify with the REST API">
          <CodeBlock
            code={`curl http://localhost:3000/api/observability/stats`}
            lang="bash"
          />
          <p className="text-xs text-slate-500">
            Returns total calls, error rate, latency percentiles, token counts, and cost. A 200
            response with non-zero{" "}
            <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">
              totalCalls
            </code>{" "}
            confirms the pipeline is working.
          </p>
        </Step>
      </div>

      {/* API reference */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">REST API reference</h2>
        <div className="space-y-3">
          {[
            { method: "GET", path: "/api/observability/calls?limit=100", desc: "List recent LLM calls" },
            { method: "GET", path: "/api/observability/stats", desc: "Latency, error rate, token totals" },
            { method: "GET", path: "/api/observability/costs", desc: "Simulated cost by endpoint and model" },
          ].map(ep => (
            <div key={ep.path} className="flex items-start gap-3 text-xs">
              <span className="font-mono shrink-0 rounded bg-cyan-300/10 px-1.5 py-0.5 text-cyan-300 text-[10px]">
                {ep.method}
              </span>
              <div>
                <code className="font-mono text-slate-300">{ep.path}</code>
                <p className="text-slate-600 mt-0.5">{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* External link */}
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View Spring AOP module source
      </a>
    </div>
  );
}

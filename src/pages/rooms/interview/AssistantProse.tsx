/**
 * KAE's own words, rendered as the markdown the contract has always promised.
 *
 * `VC-03/E`: *"the turn shape is rich; the renderer is a `<p>`."* CIE has
 * specified rich Markdown since the first slice, and Studio has been printing
 * it as one paragraph — so a reply containing a numbered list, a table of
 * options, or a snippet of configuration arrived as an unbroken wall with
 * literal `-` and `|` characters in it.
 *
 * The cost is not cosmetic. A model asked to compare three approaches produces a
 * table; flattened, the comparison is unreadable and the user asks again, which
 * is the interview repeating itself for a reason nobody can see.
 *
 * ## What is deliberately not enabled
 *
 * **No `rehype-raw`, no `dangerouslySetInnerHTML`.** Assistant prose is model
 * output rendered into an authenticated page, so raw HTML would be a script
 * injection whose payload is written by whatever the model just read — and the
 * model reads the user's repository. `react-markdown` escapes HTML by default
 * and that default is the security boundary here.
 *
 * **No images.** Nothing in a planning conversation needs one, and an `![](url)`
 * in model output is a request to a third party from inside the product.
 *
 * ## Why links open in a new tab
 *
 * A conversation is state a person is in the middle of. Following a link in the
 * same tab discards a draft in the composer, which is a cost the link never
 * discloses.
 */

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantProse({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-ink">
      <Markdown
        remarkPlugins={[remarkGfm]}
        // Every element is mapped deliberately. The default renderer produces
        // browser styles that belong to no design system, and unmapped elements
        // are how a page ends up with 2em headings inside a chat bubble.
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 marker:text-ink-subtle">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 marker:text-ink-subtle">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) =>
            // A fenced block carries a language class; inline code does not.
            // Same element, two very different jobs.
            className ? (
              <code className="block font-mono text-[12.5px] leading-relaxed">{children}</code>
            ) : (
              <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto kae-scrollbar rounded-md border border-line bg-surface-sunken p-3">
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              // A conversation is state a person is mid-way through; the same
              // tab would discard whatever is in the composer.
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent-ink underline underline-offset-2"
            >
              {children}
            </a>
          ),
          // Tables are the reason `remark-gfm` is here at all: comparing
          // options is what a planning assistant does, and a flattened
          // comparison is worse than no comparison.
          table: ({ children }) => (
            <div className="overflow-x-auto kae-scrollbar">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line bg-surface-sunken px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-line px-2 py-1 align-top">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-line-strong pl-3 text-ink-muted">
              {children}
            </blockquote>
          ),
          // Headings inside a turn are a model organising a long answer, not a
          // page structure. Rendered as emphasis so they never compete with the
          // page's own hierarchy.
          h1: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          h2: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          h3: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          hr: () => <hr className="border-line" />,
          // Absent by omission: `img`. Nothing in a planning conversation needs
          // one, and rendering it would issue a third-party request from inside
          // an authenticated page on the strength of model output.
          img: () => null,
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}

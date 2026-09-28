const CONTRACT_ADDRESS = import.meta.env.VITE_WALLET_PRINT_ADDRESS as
  | string
  | undefined
const EXPLORER_URL = (import.meta.env.VITE_EXPLORER_URL as string | undefined)
  ?.replace(/\/$/, "")
const OPENSEA_URL = import.meta.env.VITE_OPENSEA_URL as string | undefined
const X_URL = import.meta.env.VITE_X_URL as string | undefined

const isHttps = (url?: string): url is string =>
  typeof url === "string" && url.startsWith("https://")

const ZERO = "0x0000000000000000000000000000000000000000"

export function SocialLinks() {
  const links: { label: string; href: string }[] = []

  if (EXPLORER_URL && CONTRACT_ADDRESS && CONTRACT_ADDRESS !== ZERO) {
    links.push({
      label: "CONTRACT",
      href: `${EXPLORER_URL}/address/${CONTRACT_ADDRESS}#code`,
    })
  }
  if (isHttps(OPENSEA_URL)) links.push({ label: "OPENSEA", href: OPENSEA_URL })
  if (isHttps(X_URL)) links.push({ label: "X", href: X_URL })

  if (links.length === 0) return null

  return (
    <nav aria-label="Project links" className="flex items-center gap-6">
      {links.map(({ label, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[9px] tracking-[0.3em] text-white/40 hover:text-[#c5ff4e] transition-colors uppercase"
        >
          {label} ↗
        </a>
      ))}
    </nav>
  )
}

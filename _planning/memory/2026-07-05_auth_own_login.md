# Citoviso saját claude-login (2026-07-05)

## Incidens
A citoviso setupkor a mineral **másolt** claude-tokenjét kapta. Éjszaka a mineral frissítette+rotálta a közös fiók tokenjét → a citoviso másolata érvénytelen lett → a citoviso watchdog **401 Unauthorized** → nem tudta életben tartani a CIT sessionöket → disconnect.

## Tanulság (⚠️ ne ismételd)
**Ne másolj claude-tokent user-ek között.** Az OAuth-token rotálódik; a másolat egy napon belül elszáll. Minden usernek SAJÁT `claude auth login` kell.

## Fix (tartós)
`sudo -u citoviso claude auth login` (paste-code flow, telefonról jóváhagyva) → a citoviso saját, független tokent kapott (ugyanaz a fiók, olaszferenc@gmail.com, külön device-login). Ezt a citoviso saját futó claude-ja frissíti → önfenntartó. Watchdog azóta „all healthy".

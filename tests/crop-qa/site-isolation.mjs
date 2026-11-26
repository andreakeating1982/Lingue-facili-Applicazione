// Su Android Chrome l'iframe di un altro sito (la cornice sul blog) può vivere in un
// processo separato (OOPIF). Per impostazione predefinita Playwright lo tiene nel
// processo del blog e nasconde i ritardi di ridimensionamento tra cornice e app.
// LF_OOPIF=0 ripristina il comportamento senza isolamento.
export const SITE_ISOLATION_ARGS = process.env.LF_OOPIF === '0'
  ? []
  : ['--site-per-process', '--enable-features=IsolateOrigins,site-per-process'];

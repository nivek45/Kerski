import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Kerski — Sua mídia, na melhor versão.',description:'Analise e baixe conteúdo autorizado na qualidade disponível. Vídeo, áudio e arquivos separados.',robots:{index:false,follow:false}};
const theme = `(function(){try{var t=localStorage.getItem('kerski.theme.v1')||'dark';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;}catch(e){document.documentElement.dataset.theme='dark';}})()`;
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="pt-BR" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:theme}}/></head><body>{children}</body></html>;
}

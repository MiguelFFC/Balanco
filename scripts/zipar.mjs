// Compacta a pasta "dist" em "site-hostinger.zip" para enviar pelo
// Gerenciador de Arquivos da Hostinger (funciona no Windows, Mac e Linux).
import AdmZip from 'adm-zip';
import { existsSync, rmSync } from 'node:fs';

const destino = 'site-hostinger.zip';
if (!existsSync('dist/index.html')) {
  console.error('A pasta "dist" não existe. Rode "npm run hostinger".');
  process.exit(1);
}
if (existsSync(destino)) rmSync(destino);
const zip = new AdmZip();
zip.addLocalFolder('dist');
zip.writeZip(destino);
console.log(`\nPronto! Envie o arquivo ${destino} para a pasta do site na Hostinger (ex.: public_html).`);

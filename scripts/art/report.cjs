/** Summarize actual samples; never interpret SwiftShader time as phone performance. */
const fs=require('node:fs'); const root=process.argv[2]||'docs/evidence/art-001';
const before=JSON.parse(fs.readFileSync(`${root}/before/metrics.json`));
const after=JSON.parse(fs.readFileSync(`${root}/after/metrics.json`));
const mean=(a,key)=>a.reduce((v,s)=>v+s[key],0)/a.length;
let text='# Custo observado da cena\n\nChromium '+after.browser+', 1280×720, perfil desktop, SwiftShader, tráfego desligado. 30 quadros reais por câmera. Poses iguais: '+(JSON.stringify(before.poses)===JSON.stringify(after.poses))+'.\n\n';
text+='| Cena | Triângulos antes → depois | Draw calls médios antes → depois | Malhas ativas antes → depois |\n|---|---:|---:|---:|\n';
for(const name of ['shop','street','bike','interior']){
 const a=before[name],b=after[name];
 text+=`| ${name} | ${Math.round(a.triangles)} → ${Math.round(b.triangles)} | ${mean(a.samples,'drawCalls').toFixed(1)} → ${mean(b.samples,'drawCalls').toFixed(1)} | ${a.activeMeshes} → ${b.activeMeshes} |\n`;
}
text+='\nOs JSONs preservam tempos brutos de quadro/render e memória JS. A série final posterior foi capturada sem o E2E concorrente. Tempos de software continuam sensíveis à carga da máquina; não usar seu delta como regressão de hardware nem converter para FPS de celular. A comparação acima mede complexidade renderizada, incluindo cenário e sombras, não só os objetos editados. Streaming e atividade de NPCs podem alterar pequenas contagens. Nenhuma conclusão de fluidez, temperatura ou bateria em Android físico.\n';
fs.writeFileSync(`${root}/performance.md`,text);console.log(text);

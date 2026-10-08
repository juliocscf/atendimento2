import { XMLParser, XMLValidator } from 'fast-xml-parser';
export type InvoiceItem = { line: number; supplier_code: string; name: string; barcode: string; unit: string; quantity: number; unit_cost: number; total_cents: number };
export type Invoice = { invoice_key: string; supplier_tax_id: string; supplier_name: string; invoice_number: string; recipient_tax_id: string; total_cents: number; items: InvoiceItem[] };
function scalar(value: unknown, label: string, max=160): string {
 if (typeof value!=='string' || !value.trim() || value.length>max) throw new Error(`XML: ${label} inválido.`);
 return value.trim();
}
function decimal(value: unknown, label: string, positive=false) {
 if(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value)) throw new Error(`XML: ${label} inválido.`);
 const number=Number(value);
 if(!Number.isFinite(number)||number>1000000000||(positive?number<=0:number<0)) throw new Error(`XML: ${label} fora do limite.`);
 return number;
}
export function parseNfe(xml: string): Invoice {
 if (typeof xml!=='string'||Buffer.byteLength(xml,'utf8')>2_000_000) throw new Error('Envie um XML de até 2 MB.');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML com declarações externas não é permitido.');
 if(XMLValidator.validate(xml)!==true) throw new Error('O arquivo não é um XML válido.');
 const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,removeNSPrefix:true,trimValues:true,processEntities:false}).parse(xml);
 const proc=parsed.nfeProc;
 const info=proc?.NFe?.infNFe;
 const protocol=proc?.protNFe?.infProt;
 if(!info || Array.isArray(info)|| !protocol || info.ide?.mod!=='55' || info.ide?.tpNF!=='1' || info.ide?.tpAmb!=='1' || info.ide?.finNFe!=='1') throw new Error('Use o XML processado de uma NF-e normal de venda do fornecedor, modelo 55, em produção.');
 if(protocol.cStat!=='100' && protocol.cStat!=='150') throw new Error('O XML não contém protocolo de autorização.');
 const key=scalar(info['@_Id'],'chave',47).replace(/^NFe/,'');
 if(!/^\d{44}$/.test(key)||protocol.chNFe!==key) throw new Error('Chave da NF-e não confere com o protocolo.');
 let sum=0; for(let i=42,weight=2;i>=0;i--,weight=weight===9?2:weight+1) sum+=Number(key[i])*weight;
 const check=11-(sum%11); if(Number(key[43])!==(check>=10?0:check)) throw new Error('Dígito verificador da NF-e inválido.');
 const supplierTax=scalar(info.emit?.CNPJ,'CNPJ do fornecedor',14);
 if(!/^\d{14}$/.test(supplierTax)||key.slice(6,20)!==supplierTax) throw new Error('CNPJ do fornecedor não confere com a chave.');
 const details=Array.isArray(info.det)?info.det:[info.det];
 if(!details.length||details.length>500) throw new Error('A nota deve conter entre 1 e 500 itens.');
 const items: InvoiceItem[]=details.map((detail: Record<string, unknown>)=>{
  const p=detail?.prod as Record<string,unknown>;
  if(!p) throw new Error('Item da nota incompleto.');
  const line=Number(detail['@_nItem']); if(!Number.isInteger(line)||line<=0) throw new Error('Número do item inválido.');
  return {line,supplier_code:scalar(p.cProd,'código do fornecedor',60),name:scalar(p.xProd,'descrição'),barcode:typeof p.cEAN==='string'&&/^\d{8,14}$/.test(p.cEAN)?p.cEAN:'',unit:scalar(p.uCom,'unidade',10),quantity:decimal(p.qCom,'quantidade',true),unit_cost:decimal(p.vUnCom,'custo'),total_cents:Math.round(decimal(p.vProd,'total do item')*100)};
 });
 if(new Set(items.map(i=>i.line)).size!==items.length) throw new Error('A nota contém itens duplicados.');
 return {invoice_key:key,supplier_tax_id:supplierTax,supplier_name:scalar(info.emit.xNome,'fornecedor'),invoice_number:scalar(info.ide.nNF,'número',12),recipient_tax_id:scalar(info.dest?.CNPJ??info.dest?.CPF,'destinatário',14),total_cents:Math.round(decimal(info.total?.ICMSTot?.vNF,'total da nota')*100),items};
}
export function prepareReceipt(invoice: Invoice, selections: unknown) {
 if(!Array.isArray(selections)||selections.length!==invoice.items.length) throw new Error('Confira todos os itens da nota.');
 const items=invoice.items.map(item=>{
  const matches=selections.filter(s=>s?.line===item.line); const s=matches[0];
  if(matches.length!==1||typeof s?.product_id!=='string'||! /^[0-9a-f-]{36}$/i.test(s.product_id)) throw new Error(`Vincule o item ${item.line} a um produto.`);
  const factor=Number(s.factor); const qty=Math.round(item.quantity*factor*1000)/1000;
  if(!Number.isFinite(factor)||factor<=0||factor>1000000||Math.abs(factor*1e6-Math.round(factor*1e6))>0.0001||qty<=0||qty>1000000||Math.abs(item.quantity*factor-qty)>0.000001) throw new Error(`Confira a conversão do item ${item.line}; o estoque aceita até 3 casas decimais.`);
  return {...item,product_id:s.product_id,factor,quantity:qty,cost_cents:Math.round(item.unit_cost*100/factor),update_cost:s.update_cost===true};
 });
 return {...invoice,items};
}

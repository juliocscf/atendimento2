import {test,expect} from '@playwright/test';
import {parseNfe,prepareReceipt} from '../lib/nfe-import';
const prefix='3526101234567800019955001000000123100000123';
let sum=0;for(let i=42,w=2;i>=0;i--,w=w===9?2:w+1)sum+=Number(prefix[i])*w;
const digit=11-sum%11;const key=prefix+(digit>=10?0:digit);
const xml=`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}"><ide><mod>55</mod><tpNF>1</tpNF><tpAmb>1</tpAmb><finNFe>1</finNFe><nNF>123</nNF></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor teste</xNome></emit><dest><CNPJ>99888777000166</CNPJ></dest><det nItem="1"><prod><cProd>BOX</cProd><xProd>Caixa de cabos</xProd><cEAN>SEM GTIN</cEAN><uCom>CX</uCom><qCom>2.0000</qCom><vUnCom>100.00</vUnCom><vProd>200.00</vProd></prod></det><total><ICMSTot><vNF>200.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat><chNFe>${key}</chNFe></infProt></protNFe></nfeProc>`;
test('preserves invoice identifiers and converts boxes into stock units',()=>{
 const invoice=parseNfe(xml);expect(invoice.invoice_key).toHaveLength(44);expect(invoice.items[0].supplier_code).toBe('BOX');
 const receipt=prepareReceipt(invoice,[{line:1,product_id:'11111111-1111-4111-8111-111111111111',factor:10,update_cost:true}]);
 expect(receipt.items[0].quantity).toBe(20);expect(receipt.items[0].cost_cents).toBe(1000);expect(receipt.total_cents).toBe(20000);
});
test('rejects malformed, external entities, unauthorized invoices and mismatched keys',()=>{
 expect(()=>parseNfe('<bad>')).toThrow();expect(()=>parseNfe('<!DOCTYPE a [<!ENTITY secret SYSTEM "file:///secret">]>'+xml)).toThrow();
 expect(()=>parseNfe(xml.replace('<cStat>100','<cStat>101'))).toThrow();
 expect(()=>parseNfe(xml.replace('<chNFe>','<chNFe>0'))).toThrow();
 expect(()=>parseNfe(xml.replace('<tpAmb>1','<tpAmb>2'))).toThrow();
});
test('requires mappings and refuses invalid conversion',()=>{
 const invoice=parseNfe(xml);expect(()=>prepareReceipt(invoice,[])).toThrow();
 expect(()=>prepareReceipt(invoice,[{line:1,product_id:'11111111-1111-4111-8111-111111111111',factor:0}])).toThrow();
 expect(()=>prepareReceipt(invoice,[{line:1,product_id:'11111111-1111-4111-8111-111111111111',factor:0.0001}])).toThrow();
});

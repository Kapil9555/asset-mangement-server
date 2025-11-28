// function pad(n, w = 3) { return String(n).padStart(w, '0'); }
// function yyyymm(date = new Date()) {
//   const y = date.getFullYear();
//   const m = String(date.getMonth() + 1).padStart(2, '0');
//   return `${y}${m}`;
// }

import { getNextSeq } from "./seq.js";

// let counters = { CONTRACT: 1, INVOICE: 1 }; 

// export const nextContractId = () => `CTR-${yyyymm()}-${pad(counters.CONTRACT++)}`;

// export const nextInvoiceId  = () => `INV-${yyyymm()}-${pad(counters.INVOICE++)}`;



// utils/ids.js


function pad(n, w = 3) {
  return String(n).padStart(w, '0');
}

function yyyymm(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

// 🔹 Contracts: sequence per month, independent of products
export async function nextContractId() {
  const ym = yyyymm();                 // e.g. "202511"
  const key = `CONTRACT-${ym}`;        // e.g. "CONTRACT-202511"
  const seq = await getNextSeq(key);   // uses Counter collection
  return `CTR-${ym}-${pad(seq)}`;      // CTR-202511-001, CTR-202511-002...
}

// 🔹 Invoices: similar idea, own sequence
export async function nextInvoiceId() {
  const ym = yyyymm();
  const key = `INVOICE-${ym}`;
  const seq = await getNextSeq(key);
  return `INV-${ym}-${pad(seq)}`;
}

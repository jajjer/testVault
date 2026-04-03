import type { Firestore } from "firebase-admin/firestore";

const IN_CHUNK = 30;

/**
 * Maps case numbers (C1 → 1, etc.) to Firestore test case document ids, preserving order.
 */
export async function resolveCaseNumbersToIds(
  db: Firestore,
  projectId: string,
  caseNumbers: number[]
): Promise<string[]> {
  const unique = new Set(caseNumbers);
  if (unique.size !== caseNumbers.length) {
    throw new Error("caseNumbers must not contain duplicates");
  }

  const byNumber = new Map<number, string>();

  for (let i = 0; i < caseNumbers.length; i += IN_CHUNK) {
    const chunk = caseNumbers.slice(i, i + IN_CHUNK);
    const col = db
      .collection("projects")
      .doc(projectId)
      .collection("testcases");
    const qs = await col.where("caseNumber", "in", chunk).get();
    qs.forEach((doc) => {
      const n = doc.data().caseNumber;
      if (typeof n === "number") {
        byNumber.set(n, doc.id);
      }
    });
  }

  return caseNumbers.map((n) => {
    const id = byNumber.get(n);
    if (!id) {
      throw new Error(`Test case C${n} not found in this project`);
    }
    return id;
  });
}

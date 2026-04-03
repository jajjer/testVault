import {
  addDoc,
  collection,
  getDocs,
  type DocumentReference,
} from "firebase/firestore";

import { ensureDefaultSuite } from "@/lib/ensure-default-suite";
import { getFirestoreDb } from "@/lib/firebase";
import { DEFAULT_SECTION_ID, DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";

/** In-memory folder list used during import (mutated as new folders are created). */
export type TestRailSectionRow = {
  id: string;
  parentSectionId: string | null;
  name: string;
  order: number;
};

function findChild(
  sections: TestRailSectionRow[],
  parentId: string | null,
  name: string
): TestRailSectionRow | undefined {
  const n = name.trim();
  return sections.find(
    (s) => (s.parentSectionId ?? null) === parentId && s.name.trim() === n
  );
}

async function loadSections(projectId: string): Promise<TestRailSectionRow[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    collection(
      db,
      "projects",
      projectId,
      "suites",
      DEFAULT_SUITE_ID,
      "sections"
    )
  );
  return snap.docs.map((d) => {
    const data = d.data() as {
      parentSectionId?: string | null;
      name?: string;
      order?: number;
    };
    return {
      id: d.id,
      parentSectionId:
        data.parentSectionId === undefined || data.parentSectionId === null
          ? null
          : String(data.parentSectionId),
      name: String(data.name ?? ""),
      order: typeof data.order === "number" ? data.order : 0,
    };
  });
}

/**
 * Resolves a folder path to a section id, creating missing folders under the default suite.
 * Empty path → {@link DEFAULT_SECTION_ID} (unfiled).
 */
export async function ensureSectionPathForImport(
  projectId: string,
  pathSegments: string[],
  /** Mutable cache shared across rows in one import (avoids duplicate creates). */
  sections: TestRailSectionRow[]
): Promise<string> {
  const segs = pathSegments.map((s) => s.trim()).filter(Boolean);
  if (segs.length === 0) return DEFAULT_SECTION_ID;

  await ensureDefaultSuite(projectId);
  const db = getFirestoreDb();
  const coll = collection(
    db,
    "projects",
    projectId,
    "suites",
    DEFAULT_SUITE_ID,
    "sections"
  );

  let parentId: string | null = null;
  for (const name of segs) {
    let found = findChild(sections, parentId, name);
    if (!found) {
      const siblings = sections.filter(
        (s) => (s.parentSectionId ?? null) === parentId
      );
      const nextOrder =
        siblings.length === 0
          ? 0
          : Math.max(...siblings.map((s) => s.order)) + 1;
      const now = Date.now();
      const payload = {
        projectId,
        suiteId: DEFAULT_SUITE_ID,
        parentSectionId: parentId,
        name: name.trim(),
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      };
      const docRef: DocumentReference = await addDoc(coll, payload);
      found = {
        id: docRef.id,
        parentSectionId: parentId,
        name: name.trim(),
        order: nextOrder,
      };
      sections.push(found);
    }
    parentId = found.id;
  }

  return parentId ?? DEFAULT_SECTION_ID;
}

export async function loadSectionsForImportCache(
  projectId: string
): Promise<TestRailSectionRow[]> {
  await ensureDefaultSuite(projectId);
  return loadSections(projectId);
}

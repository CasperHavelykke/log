import { requireUser } from "@/lib/session";
import { getAllJobApplications } from "@/lib/queries";
import { listDocuments } from "./actions";
import { DocumentsClient } from "./documents-client";

export const metadata = { title: "Dokumenter | Log" };

export default async function DocumentsPage() {
  const user = await requireUser();
  const [documents, applications] = await Promise.all([
    listDocuments(),
    getAllJobApplications(user.id),
  ]);

  return (
    <DocumentsClient
      initialDocuments={documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        filename: d.filename,
        blobUrl: d.blobUrl,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        hasExtractedText: !!d.extractedText && d.extractedText.length > 0,
        extractedChars: d.extractedText?.length ?? 0,
        jobApplicationId: d.jobApplicationId,
        createdAt: d.createdAt,
      }))}
      applications={applications.map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role ?? "",
      }))}
    />
  );
}

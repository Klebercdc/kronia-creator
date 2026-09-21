import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeReferenceAssetFn,
  archiveReferenceAssetFn,
  listReferenceAssetsFn,
  lockReferenceAssetFn,
} from "../server/reference-studio.functions";
import type { ReferenceAsset, ReferenceContext } from "../types/reference-studio";
import type { VideoAnalysis } from "../types/video-analysis";

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReferenceStudioPanel({
  videoAnalysis,
  onContextChange,
}: {
  videoAnalysis: VideoAnalysis | null;
  onContextChange: (context: ReferenceContext | null) => void;
}) {
  const analyzeRpc = useServerFn(analyzeReferenceAssetFn);
  const listRpc = useServerFn(listReferenceAssetsFn);
  const lockRpc = useServerFn(lockReferenceAssetFn);
  const archiveRpc = useServerFn(archiveReferenceAssetFn);
  const [assets, setAssets] = useState<ReferenceAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<ReferenceAsset | null>(null);
  const [enabledLockIds, setEnabledLockIds] = useState<string[]>([]);
  const [type, setType] = useState<"person" | "product" | "video_style">("person");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [attributes, setAttributes] = useState("");
  const [negatives, setNegatives] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await listRpc();
    setAssets(result);
    setSelectedIds((current) => current.filter((id) => result.some((asset) => asset.id === id && asset.status === "locked")));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar referências."));
  }, []);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id) && asset.status === "locked"),
    [assets, selectedIds],
  );

  useEffect(() => {
    if (!selectedAssets.length) {
      onContextChange(null);
      return;
    }
    const locks = selectedAssets.flatMap((asset) =>
      asset.locks.map((lock) => ({
        ...lock,
        id: `${asset.id}:${lock.id}`,
        sourceEvidenceIds: lock.sourceEvidenceIds.map((id) => `${asset.id}:${id}`),
      })),
    );
    onContextChange({
      assetIds: selectedAssets.map((asset) => asset.id),
      locks,
      negativeConstraints: Array.from(new Set(selectedAssets.flatMap((asset) => asset.negativeConstraints))),
      version: Math.max(...selectedAssets.map((asset) => asset.version)),
    });
  }, [selectedAssets, onContextChange]);

  async function analyze() {
    if (!name.trim()) return setError("Informe um nome para a referência.");
    if (type !== "video_style" && !files.length) return setError("Envie ao menos uma imagem.");
    if (type === "video_style" && !videoAnalysis) return setError("Analise um vídeo antes de salvar o estilo.");
    if (files.reduce((sum, file) => sum + file.size, 0) > 3_000_000) {
      return setError("As imagens somadas devem ter no máximo 3 MB.");
    }
    setBusy(true);
    setError(null);
    try {
      const imageDataUrls = type === "video_style" ? undefined : await Promise.all(files.map(fileAsDataUrl));
      const asset = await analyzeRpc({
        data: {
          input: {
            type,
            name: name.trim(),
            sourceAssets: type === "video_style" ? ["current-video-analysis"] : files.map((file) => file.name),
            userProvidedAttributes: attributes.split("\n").map((value) => value.trim()).filter(Boolean),
            negativeConstraints: negatives.split("\n").map((value) => value.trim()).filter(Boolean),
          },
          imageDataUrls,
          videoAnalysis: type === "video_style" ? videoAnalysis : null,
        },
      });
      setDraft(asset);
      setEnabledLockIds(asset.locks.filter((lock) => !lock.variable).map((lock) => lock.id));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar a referência.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmLocks() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const locked = await lockRpc({ data: { id: draft.id, enabledLockIds } });
      setDraft(null);
      setName("");
      setFiles([]);
      setAttributes("");
      setNegatives("");
      await refresh();
      setSelectedIds((current) => Array.from(new Set([...current, locked.id])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar os locks.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError(null);
    try {
      await archiveRpc({ data: { id } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao arquivar a referência.");
    } finally {
      setBusy(false);
    }
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Reference Studio</div>
        <div className="hint">Analise, revise e trave personagem, produto ou estilo antes de gerar.</div>
      </div>
      {assets.some((asset) => asset.status === "locked") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="section-label">Referências ativas</div>
          {assets.filter((asset) => asset.status === "locked").map((asset) => (
            <div key={asset.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={selectedIds.includes(asset.id)}
                  onChange={(event) => setSelectedIds((current) =>
                    event.target.checked ? Array.from(new Set([...current, asset.id])) : current.filter((id) => id !== asset.id)
                  )} />
                {asset.name} · {asset.type} · v{asset.version}
              </label>
              <button type="button" className="btn-secondary" onClick={() => archive(asset.id)} disabled={busy}>Arquivar</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select className="input" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="person">Personagem</option>
          <option value="product">Produto</option>
          <option value="video_style">Estilo do vídeo analisado</option>
        </select>
        <input className="input" placeholder="Nome da referência" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      {type !== "video_style" && <input type="file" accept="image/*" multiple={type === "product"} onChange={chooseFiles} />}
      <textarea className="input" rows={2} placeholder="Atributos confirmados, um por linha"
        value={attributes} onChange={(event) => setAttributes(event.target.value)} />
      <textarea className="input" rows={2} placeholder="Restrições negativas, uma por linha"
        value={negatives} onChange={(event) => setNegatives(event.target.value)} />
      <button type="button" className="btn-secondary" onClick={analyze} disabled={busy}>
        {busy ? "Processando..." : "Analisar referência"}
      </button>
      {draft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="section-label">Revisar locks candidatos</div>
          {draft.locks.map((lock) => (
            <label key={lock.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5 }}>
              <input type="checkbox" checked={enabledLockIds.includes(lock.id)}
                onChange={(event) => setEnabledLockIds((current) =>
                  event.target.checked ? Array.from(new Set([...current, lock.id])) : current.filter((id) => id !== lock.id)
                )} />
              <span><strong>{lock.type}/{lock.attribute}</strong>: {lock.value}</span>
            </label>
          ))}
          <button type="button" className="btn-primary" onClick={confirmLocks} disabled={busy}>Confirmar e travar</button>
        </div>
      )}
      {error && <div className="hint" style={{ color: "#E5484D" }}>{error}</div>}
    </div>
  );
}

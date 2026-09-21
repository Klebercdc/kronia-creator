import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Image as ImageIcon, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { generateImagesFn } from "../server/image-generation.functions";
import { errorMessageOf } from "../lib/errors";

type Format = "square" | "portrait" | "landscape";

const FORMATS: { id: Format; label: string; detail: string }[] = [
  { id: "portrait", label: "Vertical", detail: "2:3" },
  { id: "square", label: "Quadrado", detail: "1:1" },
  { id: "landscape", label: "Horizontal", detail: "3:2" },
];

export function ImageCreator() {
  const generateImages = useServerFn(generateImagesFn);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<Format>("portrait");
  const [quantity, setQuantity] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await generateImages({ data: { prompt, format, quantity, referenceImages } });
      setImages(result.images);
    } catch (cause) {
      setError(errorMessageOf(cause, "Não foi possível gerar as imagens."));
    } finally {
      setLoading(false);
    }
  }

  async function addReferences(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 4 - referenceImages.length);
    event.target.value = "";
    if (!files.length) return;
    const urls = await Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setReferenceImages((current) => [...current, ...urls]);
  }

  function download(image: string, index: number) {
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = `kronia-imagem-${index + 1}.webp`;
    anchor.click();
  }

  return (
    <div className="image-creator">
      <header className="image-creator-header">
        <span className="image-creator-kicker"><Sparkles size={15} /> KRONIA Imagens</span>
        <h1>Crie imagens para a sua produção.</h1>
        <p>Descreva a cena, escolha o formato e gere até quatro variações.</p>
      </header>

      <form className="image-creator-form" onSubmit={submit}>
        <fieldset className="image-creator-references">
          <legend>Referências visuais <small>Opcional · produto, avatar, roupa ou cenário</small></legend>
          <div className="image-creator-reference-grid">
            {referenceImages.map((image, index) => <div key={image} className="image-creator-reference"><img src={image} alt={`Referência ${index + 1}`} /><button type="button" onClick={() => setReferenceImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover referência"><X size={14} /></button></div>)}
            {referenceImages.length < 4 && <label className="image-creator-reference-add"><Plus size={20} /><span>Adicionar</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addReferences} /></label>}
          </div>
        </fieldset>
        <label>
          O que você quer criar?
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: foto vertical de um produto de skincare em um banheiro claro, luz natural, estilo editorial" minLength={8} maxLength={3000} required />
        </label>

        <fieldset>
          <legend>Formato</legend>
          <div className="image-creator-options">
            {FORMATS.map((item) => <button key={item.id} type="button" className={format === item.id ? "active" : ""} onClick={() => setFormat(item.id)}><strong>{item.label}</strong><span>{item.detail}</span></button>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Variações</legend>
          <div className="image-creator-quantity">
            {[1, 2, 3, 4].map((value) => <button key={value} type="button" className={quantity === value ? "active" : ""} onClick={() => setQuantity(value)}>{value}</button>)}
          </div>
        </fieldset>

        {error && <p className="image-creator-error">{error}</p>}
        <button className="image-creator-submit" disabled={loading} type="submit">
          {loading ? <><LoaderCircle className="spin" size={19} /> Gerando imagens…</> : <><ImageIcon size={19} /> Gerar {quantity === 1 ? "imagem" : `${quantity} imagens`}</>}
        </button>
      </form>

      {images.length > 0 && <section className="image-creator-results"><h2>Imagens geradas</h2><div className="image-creator-grid">{images.map((image, index) => <article key={image}><img src={image} alt={`Imagem gerada ${index + 1}`} /><button type="button" onClick={() => download(image, index)}><Download size={16} /> Baixar</button></article>)}</div></section>}
    </div>
  );
}

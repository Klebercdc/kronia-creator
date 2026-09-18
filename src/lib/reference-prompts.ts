import rawEntries from "../data/reference-prompts.json";

/**
 * Roteiros prontos — prompts de vídeo completo (não movimento solto),
 * reverse-engineered de vídeos reais que venderam #1 por categoria de
 * e-commerce (dataset público da Clipcat, CC BY 4.0). Cada `prompt` já
 * vem com Style/Environment/Tone/Camera/Lighting/Character/Shots — é um
 * roteiro inteiro de 10-25s, pronto pra colar no Flow, não algo pra
 * combinar com outros (diferente da Biblioteca de Movimentos).
 *
 * Sem nenhum link/vídeo/creator do TikTok — só o texto do prompt (o
 * link original ficava no campo `source`, removido nessa versão).
 *
 * Aviso de licença: alguns Shots citam a fala original do vídeo (campo
 * "Subject:" dentro do prompt) — isso é dado de terceiro pra referência
 * de ritmo/estrutura, a CC BY 4.0 não cobre reprodução literal dessa fala
 * como copy final. A tela mostra esse aviso, o dado não é filtrado.
 */
export interface ReferencePromptEntry {
  id: string;
  title: string;
  market: string;
  category: string;
  categorySlug: string;
  videoType: string;
  durationSec: number;
  hook: string;
  painPoint: string | null;
  prompt: string;
}

const ENTRIES = rawEntries as ReferencePromptEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

/** Categoria original vem em inglês/slug (dataset da Clipcat) — traduzido
 * fixo aqui pra ficar navegável em português; `painPoint` (texto livre,
 * 387 entradas) é traduzido à parte, direto no dataset (ver script de
 * tradução), porque não dá pra mapear frase livre com um dicionário fixo. */
const CATEGORY_LABEL_PT: Record<string, string> = {
  "automotive-motorcycle": "Automotivo e Motocicleta",
  "baby-maternity": "Bebê e Maternidade",
  "beauty-personal-care": "Beleza e Cuidados Pessoais",
  "books-magazines-audio": "Livros, Revistas e Áudio",
  collectibles: "Colecionáveis",
  "computers-office-equipment": "Informática e Escritório",
  "fashion-accessories": "Acessórios de Moda",
  "food-beverages": "Alimentos e Bebidas",
  furniture: "Móveis",
  health: "Saúde",
  "home-improvement": "Reforma e Construção",
  "home-supplies": "Utilidades Domésticas",
  "household-appliances": "Eletrodomésticos",
  "jewelry-accessories-derivatives": "Joias e Bijuterias",
  "kids-fashion": "Moda Infantil",
  kitchenware: "Utensílios de Cozinha",
  "luggage-bags": "Malas e Bolsas",
  "menswear-underwear": "Moda Masculina e Íntima",
  "pet-supplies": "Produtos para Pet",
  "phones-electronics": "Celulares e Eletrônicos",
  shoes: "Calçados",
  "sports-outdoor": "Esporte e Ar Livre",
  "textiles-soft-furnishings": "Têxteis e Cama/Mesa/Banho",
  "tools-hardware": "Ferramentas",
  "toys-hobbies": "Brinquedos e Hobbies",
  "womenswear-underwear": "Moda Feminina e Íntima",
  "pre-owned": "Usados",
  "muslim-fashion": "Moda Muçulmana",
  "bookings-vouchers": "Reservas e Vouchers",
  "virtual-products": "Produtos Virtuais",
};

/** `category` (não `categorySlug`) é a chave certa aqui — o dataset usa
 * hífen duplo em `categorySlug` pra categorias com "&" no nome original
 * (ex: `categorySlug: "automotive--motorcycle"` vs `category:
 * "automotive-motorcycle"`), então bater no mapa por categorySlug erra
 * silenciosamente pra metade das categorias e cai no fallback em inglês. */
function categoryLabelPt(category: string): string {
  return (
    CATEGORY_LABEL_PT[category] ??
    category
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export interface ReferencePromptCategory {
  slug: string;
  label: string;
  count: number;
}

export function listReferencePromptCategories(): ReferencePromptCategory[] {
  const bySlug = new Map<string, ReferencePromptCategory>();
  for (const e of ENTRIES) {
    const existing = bySlug.get(e.categorySlug);
    if (existing) {
      existing.count += 1;
    } else {
      bySlug.set(e.categorySlug, { slug: e.categorySlug, label: categoryLabelPt(e.category), count: 1 });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label));
}

const PAGE_SIZE = 20;

export interface ReferencePromptCard {
  id: string;
  title: string;
  market: string;
  durationSec: number;
  hook: string;
  painPoint: string | null;
}

export interface ReferencePromptPage {
  cards: ReferencePromptCard[];
  total: number;
}

export function listReferencePromptsByCategory(categorySlug: string, offset = 0): ReferencePromptPage {
  const filtered = ENTRIES.filter((e) => e.categorySlug === categorySlug);
  const cards = filtered.slice(offset, offset + PAGE_SIZE).map((e) => ({
    id: e.id,
    title: e.title,
    market: e.market,
    durationSec: e.durationSec,
    hook: e.hook,
    painPoint: e.painPoint,
  }));
  return { cards, total: filtered.length };
}

export function getReferencePrompt(id: string): ReferencePromptEntry | null {
  return BY_ID.get(id) ?? null;
}

import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Políticas e condições",
};

const policies: Array<{ title: string; body: string }> = [
  {
    title: "Transporte",
    body:
      "O transporte é feito em ônibus/vans de turismo com ar-condicionado, em parceria com empresas credenciadas. " +
      "Os assentos são liberados, salvo quando indicado de outra forma na página da viagem. " +
      "Saídas e retornos seguem os horários de embarque informados; recomenda-se chegar com 15 minutos de antecedência. " +
      "A política de transporte específica de cada destino está descrita na página da própria excursão.",
  },
  {
    title: "Crianças",
    body:
      "Algumas viagens oferecem valor especial para crianças. O limite de idade e o valor são informados na página da excursão. " +
      "Crianças até 3 anos acompanhadas dos pais podem viajar sem custo quando o grupo for privado; em bate-volta convencionais, " +
      "salvo indicação contrária, crianças pagam conforme o valor definido para a viagem. " +
      "Em viagens com política específica, a criança é contabilizada como passageiro e ocupa assento próprio.",
  },
  {
    title: "Pagamento",
    body:
      "A reserva é confirmada somente após a confirmação do pagamento. No PIX, a confirmação pode levar alguns minutos. " +
      "Descontos promocionais podem ser combinados de acordo com a política de cada viagem. " +
      "O pagamento no cartão ocorre em uma única parcela, a menos que o parcelamento esteja indicado na página da excursão.",
  },
  {
    title: "Cancelamento, remarcação e reembolso",
    body:
      "Cada excursão possui política de cancelamento própria, descrita na página da viagem antes da reserva. " +
      "Solicitações de cancelamento devem ser feitas pelo WhatsApp oficial da agência informado no rodapé. " +
      "A agência pode cancelar a excursão por número insuficiente de participantes ou por motivos de força maior; " +
      "nesse caso, o reembolso integral é garantido na forma combinada.",
  },
];

export default async function PoliciesPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div className="section-pad">
      <div className="container-page max-w-4xl">
        <div className="brand-panel">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/80">
            Transparência
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Políticas e condições
          </h1>
          <p className="mt-3 max-w-xl text-white/90">
            Como funcionam transporte, crianças, pagamento e cancelamento nas
            excursões da {store.brand.companyName}.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {policies.map((p) => (
            <div key={p.title} className="surface-card p-6">
              <h2 className="font-display text-xl font-bold text-brand-ink">
                {p.title}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-muted">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 leading-relaxed text-brand-muted">
          Antes de reservar, confira a política específica da viagem na página
          dela — incluindo pontos de embarque, política de transporte, faixa de
          idade infantil e política de cancelamento.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/excursoes">Ver excursões</Button>
          <Button href="/contato" variant="outline">
            Dúvidas? Fale conosco
          </Button>
        </div>
      </div>
    </div>
  );
}
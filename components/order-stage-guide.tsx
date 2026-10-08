'use client';

import { type Status, statuses } from '@/lib/demo';

const explanations: Record<Status, { title: string; detail: string }> = {
  Recebido: { title: 'Conferir a solicitação', detail: 'Confirme cliente, equipamento e problema informado. Depois inicie o diagnóstico.' },
  Diagnóstico: { title: 'Descobrir o defeito e preparar a proposta', detail: 'Registre o serviço ou peça necessária, preço e condições. O cliente ainda não recebeu nada.' },
  'Aguardando aprovação': { title: 'Aguardar a decisão do cliente', detail: 'Envie o link da proposta e acompanhe a resposta. A execução só começa após a aprovação.' },
  'Em execução': { title: 'Realizar apenas o serviço autorizado', detail: 'Registre atividades e anexos enquanto executa o que o cliente aprovou.' },
  'Em testes': { title: 'Verificar o resultado', detail: 'Teste o equipamento e confirme que o problema foi resolvido.' },
  'Pronto para entrega': { title: 'Combinar a retirada', detail: 'O equipamento está pronto. Confirme a entrega ao cliente antes de concluir.' },
  Concluído: { title: 'Atendimento finalizado', detail: 'O histórico e a proposta permanecem vinculados a esta OS.' },
  Cancelada: { title: 'Atendimento cancelado', detail: 'Esta OS não terá novas etapas. O motivo permanece registrado no histórico.' },
  Anulada: { title: 'Atendimento anulado', detail: 'Esta OS foi anulada após a conclusão. O motivo e o estorno do estoque permanecem registrados no histórico.' },
};

export function OrderStageGuide({ status }: { status: Status }) {
  if (status === 'Cancelada' || status === 'Anulada') return <section className="order-stage-guide" aria-label={status === 'Anulada' ? 'Atendimento anulado' : 'Atendimento cancelado'}><div className="order-stage-current"><span>Atendimento encerrado</span><b>{explanations[status].title}</b><p>{explanations[status].detail}</p></div></section>;
  const step = statuses.indexOf(status as typeof statuses[number]);
  return <section className="order-stage-guide" aria-label="Etapas do atendimento">
    <div className="order-stage-current"><span>Etapa {step + 1} de {statuses.length}</span><b>{explanations[status].title}</b><p>{explanations[status].detail}</p></div>
    <ol>{statuses.map((item, index) => <li key={item} className={index < step ? 'done' : index === step ? 'current' : ''}><span>{index < step ? '✓' : index + 1}</span><small>{item}</small></li>)}</ol>
  </section>;
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface LegalCompanyInfo {
  name?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface TermsAndPrivacyProps {
  company?: LegalCompanyInfo;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1.5">
    <h4 className="font-bold text-stone-900 text-sm">{title}</h4>
    <div className="text-stone-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

export const TermsAndPrivacy: React.FC<TermsAndPrivacyProps> = ({ company }) => {
  const companyName = company?.name || 'Café com destino';
  const cnpj = company?.cnpj || '[CNPJ]';
  const address = company?.address || '[Endereço completo do estabelecimento]';
  const phone = company?.phone || '[Telefone de contato]';
  const email = company?.email || '[E-mail de contato]';

  return (
    <div className="space-y-6 text-xs">
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-amber-900">
          Este texto é um modelo gerado para servir de ponto de partida e não substitui orientação jurídica.
          Antes de publicar oficialmente para clientes e funcionários, recomendamos revisão por um advogado,
          especialmente quanto à Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e às regras do seu
          município/estado para delivery e emissão fiscal.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-stone-900 text-base">Termos de Uso</h3>
        <p className="text-stone-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <div className="space-y-4">
        <Section title="1. Aceitação dos Termos">
          <p>
            Ao acessar ou utilizar o sistema e o cardápio online de <strong>{companyName}</strong>
            {' '}("nós", "restaurante"), você ("usuário", "cliente") concorda com estes Termos de Uso e com a
            Política de Privacidade descrita abaixo. Se você não concordar com algum ponto, pedimos que não
            utilize o sistema.
          </p>
        </Section>

        <Section title="2. Descrição do Serviço">
          <p>
            O sistema permite consultar o cardápio, realizar pedidos para entrega, retirada ou consumo no
            local, acompanhar o status do pedido e efetuar pagamento. Internamente, o mesmo sistema também é
            usado pela equipe do restaurante para operação de mesas, cozinha, caixa, estoque e gestão
            administrativa — o uso interno por funcionários está sujeito a regras adicionais definidas pelo
            empregador.
          </p>
        </Section>

        <Section title="3. Cadastro e Responsabilidade pelas Informações">
          <p>
            O usuário é responsável por fornecer informações verdadeiras, completas e atualizadas (nome,
            telefone, endereço de entrega) no momento do pedido. Dados incorretos podem atrasar ou impedir a
            entrega, sem responsabilidade do restaurante pelo atraso decorrente.
          </p>
        </Section>

        <Section title="4. Pedidos, Preços e Disponibilidade">
          <p>
            Preços, fotos, descrições e disponibilidade dos produtos podem ser alterados sem aviso prévio. Um
            pedido só é considerado confirmado após a aprovação do pagamento e o recebimento pela cozinha. O
            restaurante pode recusar ou cancelar um pedido em caso de indisponibilidade de produto, erro de
            sistema no preço exibido, ou suspeita de fraude, com reembolso integral quando aplicável.
          </p>
        </Section>

        <Section title="5. Pagamento">
          <p>
            Pagamentos online são processados por parceiro de pagamento terceirizado; o restaurante não
            armazena dados completos de cartão de crédito/débito. Em caso de pagamento na entrega ou retirada,
            as formas aceitas são informadas no momento do pedido.
          </p>
        </Section>

        <Section title="6. Entrega">
          <p>
            Prazos de entrega são estimativas e podem variar por distância, trânsito, clima e volume de
            pedidos. A taxa de entrega, quando aplicável, é informada antes da confirmação do pedido.
          </p>
        </Section>

        <Section title="7. Cancelamento e Trocas">
          <p>
            Pedidos já em preparo ou despachados podem não ser cancelados. Problemas com o pedido recebido
            (item errado, ausente ou com qualidade inadequada) devem ser reportados o quanto antes pelo canal
            de atendimento informado no rodapé deste documento, para avaliação de reembolso ou reenvio.
          </p>
        </Section>

        <Section title="8. Propriedade Intelectual">
          <p>
            Marca, logotipo, fotos do cardápio e demais conteúdos exibidos pertencem a {companyName} ou a
            terceiros licenciantes, sendo vedada a reprodução sem autorização.
          </p>
        </Section>

        <Section title="9. Limitação de Responsabilidade">
          <p>
            O restaurante não se responsabiliza por indisponibilidade temporária do sistema por manutenção,
            falha de conexão ou de terceiros (ex.: processador de pagamento, provedor de infraestrutura).
          </p>
        </Section>

        <Section title="10. Alterações nestes Termos">
          <p>
            Estes Termos podem ser atualizados a qualquer momento. A versão vigente é sempre a publicada nesta
            mesma tela, com a data de atualização indicada acima.
          </p>
        </Section>

        <Section title="11. Legislação Aplicável">
          <p>
            Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca do domicílio de
            {' '}{companyName} para dirimir eventuais controvérsias, salvo disposição legal em contrário
            (ex.: foro do consumidor).
          </p>
        </Section>
      </div>

      <div className="border-t pt-5 space-y-1">
        <h3 className="font-bold text-stone-900 text-base">Política de Privacidade</h3>
        <p className="text-stone-500">Elaborada com base na Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
      </div>

      <div className="space-y-4">
        <Section title="1. Quem é o Controlador dos Dados">
          <p>
            <strong>{companyName}</strong>, CNPJ {cnpj}, com sede em {address}, é a controladora dos dados
            pessoais tratados através deste sistema.
          </p>
        </Section>

        <Section title="2. Quais Dados Coletamos">
          <p><strong>De clientes:</strong> nome, telefone/WhatsApp, endereço de entrega, forma de pagamento escolhida, itens e observações do pedido.</p>
          <p><strong>De funcionários:</strong> nome, e-mail, telefone, CPF, cargo e permissões de acesso, PIN de fechamento de caixa, registros de ações realizadas no sistema (auditoria).</p>
          <p><strong>Dados de uso:</strong> preferências salvas localmente no navegador (ex.: pedidos em acompanhamento), para melhorar a experiência de uso.</p>
        </Section>

        <Section title="3. Para Que Usamos Esses Dados">
          <p>
            Processar e entregar pedidos; emitir documentos fiscais quando aplicável; entrar em contato sobre
            o andamento do pedido; gerenciar contas de funcionários e controlar o que cada um pode acessar no
            sistema; cumprir obrigações legais e fiscais; prevenir fraude.
          </p>
        </Section>

        <Section title="4. Base Legal do Tratamento">
          <p>
            Execução de contrato (processar o pedido que você fez), cumprimento de obrigação legal ou
            regulatória (ex.: emissão de nota fiscal), e legítimo interesse do controlador para prevenção a
            fraudes e melhoria do serviço, sempre de forma proporcional e sem prejudicar os direitos do
            titular dos dados.
          </p>
        </Section>

        <Section title="5. Com Quem Compartilhamos">
          <p>
            Entregador designado para o seu pedido (recebe nome, telefone e endereço só do pedido que ele
            está entregando); processador de pagamentos, para aprovar a transação; autoridades públicas,
            quando exigido por lei ou ordem judicial. Não vendemos dados pessoais a terceiros.
          </p>
        </Section>

        <Section title="6. Como Protegemos Seus Dados">
          <p>
            Os dados são armazenados em infraestrutura com controle de acesso por autenticação e permissões —
            cada funcionário só acessa telas e ações liberadas para o seu cargo. Conexões com o sistema usam
            criptografia em trânsito (HTTPS).
          </p>
        </Section>

        <Section title="7. Por Quanto Tempo Guardamos os Dados">
          <p>
            Pelo tempo necessário para cumprir a finalidade do tratamento e as obrigações legais aplicáveis
            (ex.: guarda de documentos fiscais pelo prazo exigido pela legislação tributária), podendo ser
            mantidos por período adicional para exercício regular de direitos em processos administrativos ou
            judiciais.
          </p>
        </Section>

        <Section title="8. Seus Direitos como Titular dos Dados">
          <p>Conforme o Art. 18 da LGPD, você pode solicitar a qualquer momento:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
            <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
            <li>Eliminação dos dados tratados com base no seu consentimento;</li>
            <li>Informação sobre com quem compartilhamos seus dados;</li>
            <li>Revogação do consentimento, quando o tratamento for baseado nele.</li>
          </ul>
        </Section>

        <Section title="9. Cookies e Armazenamento Local">
          <p>
            O sistema usa o armazenamento local do navegador (localStorage) para lembrar preferências e
            pedidos recentes em acompanhamento, apenas no dispositivo do próprio usuário — esses dados não são
            enviados a terceiros.
          </p>
        </Section>

        <Section title="10. Como Falar Conosco Sobre Seus Dados">
          <p>
            Para exercer seus direitos ou tirar dúvidas sobre esta política, entre em contato por telefone
            {' '}{phone} ou e-mail {email}.
          </p>
        </Section>

        <Section title="11. Alterações nesta Política">
          <p>
            Esta política pode ser atualizada para refletir mudanças no sistema ou na legislação. A versão
            vigente é sempre a publicada nesta mesma tela.
          </p>
        </Section>
      </div>
    </div>
  );
};

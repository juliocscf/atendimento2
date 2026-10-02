import { expect, test } from '@playwright/test';

test('filtros, ficha, edicao persistente e atendimento do cliente', async ({ page }) => {
  await page.goto('/clientes');
  await expect(page.getByText('9 clientes cadastrados')).toBeVisible();
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de pessoa' }).selectOption('cnpj');
  await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await page.getByRole('button', { name: 'Abrir ficha de Lucas Ferreira' }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('heading', { name: 'Lucas Ferreira', exact: true })).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Equipamentos (1)' })).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Histórico de atendimentos (1)' })).toBeVisible();
  await detail.getByRole('button', { name: 'Editar cadastro' }).click();
  await page.getByLabel('Nome para atendimento').fill('Lucas Ferreira Atualizado');
  await page.getByLabel('Observações', { exact: true }).fill('Preferência de contato por telefone.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('button', { name: 'Abrir ficha de Lucas Ferreira Atualizado' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Abrir ficha de Lucas Ferreira Atualizado' }).click();
  await expect(page.getByText('Preferência de contato por telefone.', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Novo atendimento' }).click();
  await expect(page.getByRole('combobox', { name: 'Cliente', exact: true })).toHaveValue('c1');
  await expect(page.getByRole('combobox', { name: 'Equipamento', exact: true })).toHaveValue('d1');
});

test('busca, paginação e ordem cronológica independente dos ids', async ({ page }) => {
  await page.addInitScript(() => {
    const clients = Array.from({length: 25}, (_, i) => ({ id: `c${i}`, name: `Cliente ${String(i).padStart(2,'0')}`, phone: '11999999999', email: '', address: '' }));
    const order = { clientId: 'c0', deviceId: '', mode: 'Balcão', status: 'Recebido', priority: 'Normal', technician: '', issue: 'Teste cronologico', due: '2026-10-10', amount: 0, paid: 0, accessories: '', history: [], contacts: [] };
    localStorage.setItem('atendimento-2:prototype:v1', JSON.stringify({ version: 1, clients, devices: [], appointments: [], orders: [{...order, id: 'zzz', number: 'OS-antiga', createdAt:'2026-09-01T00:00:00Z'}, {...order, id:'aaa', number:'OS-recente', createdAt:'2026-10-01T00:00:00Z'}] }));
  });
  await page.goto('/clientes');
  await expect(page.getByText('25 clientes cadastrados')).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Abrir ficha de Cliente 00' }) });
  await expect(row.getByText('OS-recente')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await page.getByLabel('Buscar no sistema').fill('Cliente 24');
  await expect(page.getByText('1 cliente cadastrado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir ficha de Cliente 24' })).toBeVisible();
  await page.getByRole('button', { name: 'Atalhos' }).click();
  await expect(page.getByRole('dialog').getByText('Ctrl / ⌘ + K')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('cadastro com consulta CNPJ e ficha acessível no celular', async ({ page }) => {
  await page.route('**/api/lookup/cnpj?*', route => route.fulfill({ json: { data: { legalName: 'Empresa teste', tradeName: 'Empresa QA', phone:'11999999999', email:'qa@example.com', postalCode:'75800029', street:'Rua teste', number:'10', complement:'', neighborhood:'Centro', city:'Jatai', state:'GO', status:'ATIVA' } } }));
  await page.route('**/api/lookup/cep?*', route => route.fulfill({json:{data:{postalCode:'75800029',street:'Rua teste',complement:'',neighborhood:'Centro',city:'Jatai',state:'GO'}}}));
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.getByRole('button', { name: 'Pessoa jurídica' }).click();
  await page.getByPlaceholder('00.000.000/0000-00').fill('37596264000160');
  await page.getByRole('button', { name: 'Consultar CNPJ' }).click();
  await expect(page.getByLabel('Nome para atendimento')).toHaveValue('Empresa QA');
  await page.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(page.getByRole('button', {name:'Abrir ficha de Empresa QA'})).toBeVisible();
  await page.setViewportSize({ width:390, height:844 });
  await page.getByRole('button', { name: 'Empresa QA' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', {name:'Empresa QA',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Rua teste, 10, Centro, Jatai, GO')).toBeVisible();
});


test('cadastra varios equipamentos no mesmo formulario e permite adicionar outro na edicao', async ({ page }) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.getByPlaceholder('000.000.000-00').fill('52998224725');
  await page.getByLabel('Nome para atendimento').fill('Cliente com equipamentos');
  await page.getByLabel('Telefone', { exact: true }).fill('11999999999');
  await page.getByRole('button', { name: 'Adicionar equipamento' }).click();
  let items = page.getByRole('group', { name: 'Equipamento 1' });
  await items.getByLabel('Marca').fill('Dell');
  await items.getByLabel('Modelo').fill('Latitude');
  await items.getByLabel('Número de série').fill('SN-001');
  await page.getByRole('button', { name: 'Adicionar equipamento' }).click();
  items = page.getByRole('group', { name: 'Equipamento 2' });
  await items.getByLabel('Tipo').selectOption('Desktop');
  await items.getByLabel('Marca').fill('Lenovo');
  await items.getByLabel('Modelo').fill('ThinkCentre');
  await page.getByRole('button', { name: 'Adicionar equipamento' }).click();
  await page.getByRole('button', { name: 'Remover equipamento 3' }).click();
  await expect(page.getByText('2 de 10 adicionados')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Abrir ficha de Cliente com equipamentos' }) });
  await expect(row.getByText('2 equipamentos')).toBeVisible();
  await row.getByRole('button', { name: 'Abrir ficha de Cliente com equipamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Equipamentos (2)' })).toBeVisible();
  await expect(page.getByText('Dell Latitude')).toBeVisible();
  await expect(page.getByText('Lenovo ThinkCentre')).toBeVisible();
  await page.getByRole('button', { name: 'Editar cadastro' }).click();
  await page.getByRole('button', { name: 'Adicionar equipamento' }).click();
  await page.getByRole('group', { name: 'Equipamento 1' }).getByLabel('Marca').fill('Apple');
  await page.getByRole('group', { name: 'Equipamento 1' }).getByLabel('Modelo').fill('MacBook Air');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: 'Equipamentos (3)' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Abrir ficha de Cliente com equipamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Equipamentos (3)' })).toBeVisible();
});

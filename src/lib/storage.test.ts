import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===========================================================================
// Upload de imagem pro Supabase Storage: valida o arquivo ANTES de chamar a
// rede, escolhe a pasta certa por tipo de asset e traduz os erros comuns do
// Storage (bucket ausente / RLS sem policy) pra mensagem que o usuário entende.
// ===========================================================================

const { uploadMock, getPublicUrlMock, fromMock } = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }));
  return { uploadMock, getPublicUrlMock, fromMock };
});

vi.mock('./supabaseClient', () => ({
  supabase: { storage: { from: fromMock } },
}));

const { uploadProductImage, uploadCompanyAsset } = await import('./storage');

const makeFile = (over: Partial<{ type: string; size: number; name: string }> = {}) => {
  const size = over.size ?? 1024;
  return new File([new Uint8Array(size)], over.name ?? 'foto.jpg', { type: over.type ?? 'image/jpeg' });
};

beforeEach(() => {
  uploadMock.mockReset();
  getPublicUrlMock.mockReset();
  fromMock.mockClear();
});

describe('uploadProductImage', () => {
  it('rejeita formato inválido sem chamar o Storage', async () => {
    await expect(uploadProductImage(makeFile({ type: 'application/pdf' }))).rejects.toThrow('Formato inválido');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejeita arquivo maior que 512 KB sem chamar o Storage', async () => {
    await expect(uploadProductImage(makeFile({ size: 600 * 1024 }))).rejects.toThrow('Imagem muito grande');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('sobe no bucket "product-images", pasta "produtos", e devolve a URL pública', async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } });

    const url = await uploadProductImage(makeFile());

    expect(url).toBe('https://cdn/x.jpg');
    expect(fromMock).toHaveBeenCalledWith('product-images');
    const [path, , opts] = uploadMock.mock.calls[0];
    expect(path).toMatch(/^produtos\/.+\.jpg$/);
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: false });
  });

  it('mensagem amigável quando o bucket não existe', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'Bucket not found' } });
    await expect(uploadProductImage(makeFile())).rejects.toThrow('O bucket "product-images" não existe');
  });

  it('mensagem amigável quando falta policy de RLS no Storage', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });
    await expect(uploadProductImage(makeFile())).rejects.toThrow('Sem permissão para enviar ao Storage');
  });

  it('repassa a mensagem de erro genérica do Storage', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'network down' } });
    await expect(uploadProductImage(makeFile())).rejects.toThrow('Falha no upload da imagem: network down');
  });
});

describe('uploadCompanyAsset', () => {
  it('sobe na pasta "empresa" em vez de "produtos"', async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/logo.png' } });

    await uploadCompanyAsset(makeFile({ type: 'image/png', name: 'logo.png' }));

    const [path] = uploadMock.mock.calls[0];
    expect(path).toMatch(/^empresa\/.+\.png$/);
  });
});

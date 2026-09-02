import { supabase } from './supabaseClient';
import { validateImageFile } from './validation';

// Bucket PÚBLICO do Supabase Storage onde ficam as imagens do app (fotos de
// produto, logo e capa da empresa). Precisa existir: Dashboard → Storage →
// New bucket → "product-images", marcar "Public bucket". E policies de escrita
// para o papel `authenticated` (veja o SQL no fim do arquivo).
const IMAGES_BUCKET = 'product-images';

/**
 * Sobe uma imagem pro Storage e devolve a URL pública (curta) — é isso que vai
 * pra `products.image_url` / `company_profile.logo_url` / `cover_url`. Nada de
 * base64 embutido: não cabe no limite de 2048 chars das colunas e incharia
 * todas as queries.
 */
async function uploadImage(file: File, folder: string): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('O bucket "product-images" não existe. Crie em Storage → New bucket (público).');
    }
    if (/row-level security|not authorized|permission/i.test(error.message)) {
      throw new Error('Sem permissão para enviar ao Storage. Falta a policy de upload no bucket "product-images".');
    }
    throw new Error(`Falha no upload da imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const uploadProductImage = (file: File) => uploadImage(file, 'produtos');
export const uploadCompanyAsset = (file: File) => uploadImage(file, 'empresa');

/*
-- Policies do bucket (rode uma vez no SQL Editor, ou configure em Storage → Policies):
--   leitura já é pública porque o bucket é "Public".
--   escrita: só funcionário logado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 524288,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 524288,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

create policy "product_images_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "product_images_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

create policy "product_images_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
*/

# Supabase Storage setup

Use Supabase Storage when PDF lesson materials must stay available on the free Render plan.

## Steps

1. Create a free Supabase project.
2. Open Storage and create a private bucket named `video-materials`.
3. Open Project Settings > API and copy:
   - Project URL
   - `service_role` key
4. Add these environment variables to Render:
   - `SUPABASE_URL=your Project URL`
   - `SUPABASE_SERVICE_ROLE_KEY=your service_role key`
   - `SUPABASE_STORAGE_BUCKET=video-materials`
5. Redeploy the Render service.

When these variables are set, PDFs uploaded from `/admin` are saved to Supabase.
Without these variables, local development continues to save PDFs under `data/video-pdfs`.

Keep the `service_role` key private. Do not expose it in browser JavaScript, public files, or GitHub.

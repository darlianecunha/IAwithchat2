# Ajustes aplicados
Foram adicionadas rotas serverless e um utilitário para chamar o backend sem expor a chave.
## Arquivos adicionados:
- `api/chat.ts`
- `api/edit-image.ts`
- `api/chat-voice.ts`
- `vercel.json`
- `utils/serverApi.ts`

## Próximos passos no seu código de UI (Vite/React):
1) Substitua qualquer uso de `@google/generative-ai` no **cliente** por chamadas ao `utils/serverApi.ts`.
2) No Vercel, crie a variável `GOOGLE_API_KEY`.
3) Faça redeploy.

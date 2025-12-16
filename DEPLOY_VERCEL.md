# 🚀 Guía de Despliegue en Vercel

## Portal Alunos e Professor

---

## 📋 Opción 1: Despliegue Automático desde GitHub (RECOMENDADO)

### Paso 1: Conectar Repositorio a Vercel

1. **Ir a Vercel:**
   - Abre [vercel.com](https://vercel.com)
   - Inicia sesión con tu cuenta de GitHub

2. **Importar Proyecto:**
   - Click en **"Add New..."** → **"Project"**
   - Busca el repositorio: `conexionamerica/site-para-alunos-e-professor-`
   - Click en **"Import"**

3. **Configurar Proyecto:**
   ```
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Variables de Entorno:**
   
   Si tu proyecto usa Supabase, agrega estas variables:
   ```
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

5. **Deploy:**
   - Click en **"Deploy"**
   - Espera 2-3 minutos
   - ¡Listo! Tu sitio estará en: `https://tu-proyecto.vercel.app`

---

## 📋 Opción 2: Despliegue con Vercel CLI

### Instalación de Vercel CLI

```bash
npm install -g vercel
```

### Despliegue

```bash
# 1. Navegar al directorio del proyecto
cd "site-para-alunos-e-professor-"

# 2. Login en Vercel
vercel login

# 3. Desplegar
vercel

# 4. Para producción
vercel --prod
```

---

## 🔄 Actualizaciones Automáticas

Una vez conectado a Vercel:

✅ **Cada push a `main`** → Despliega automáticamente en producción  
✅ **Cada push a otras ramas** → Crea preview deployment  
✅ **Pull Requests** → Genera URL de preview

---

## ⚙️ Configuración Avanzada

### Build Settings

El archivo `vercel.json` ya está configurado:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Esto asegura que React Router funcione correctamente.

### Variables de Entorno

Para agregar variables de entorno:

1. Ve a tu proyecto en Vercel
2. **Settings** → **Environment Variables**
3. Agrega las variables necesarias
4. Redeploy el proyecto

---

## 🧪 Testing del Deploy

Después del deploy, verifica:

1. ✅ **Página principal** carga correctamente
2. ✅ **Login** funciona
3. ✅ **Dashboard de profesor** accesible
4. ✅ **Todas las rutas** funcionan (gracias a rewrites)
5. ✅ **Conexión a Supabase** activa

---

## 🐛 Solución de Problemas

### Error: "Build failed"

**Causa:** Dependencias faltantes o errores de compilación

**Solución:**
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: "404 en rutas"

**Causa:** Falta configuración de rewrites

**Solución:** Verifica que `vercel.json` existe y tiene el contenido correcto

### Error: "Environment variables not found"

**Causa:** Variables de entorno no configuradas

**Solución:** Agregar variables en Vercel Dashboard → Settings → Environment Variables

---

## 📊 Monitoreo

Vercel proporciona:

- 📈 **Analytics** - Tráfico y performance
- 🔍 **Logs** - Errores y warnings
- ⚡ **Speed Insights** - Métricas de velocidad
- 🌍 **Edge Network** - CDN global

---

## 🔗 URLs Importantes

Después del deploy tendrás:

- **Producción:** `https://site-para-alunos-e-professor.vercel.app`
- **Preview:** `https://site-para-alunos-e-professor-git-branch.vercel.app`
- **Dashboard:** `https://vercel.com/tu-usuario/site-para-alunos-e-professor`

---

## ✅ Checklist de Deploy

- [ ] Repositorio en GitHub actualizado
- [ ] Variables de entorno configuradas
- [ ] Build local exitoso (`npm run build`)
- [ ] Proyecto importado en Vercel
- [ ] Deploy completado
- [ ] Testing en producción
- [ ] DNS configurado (si usas dominio custom)

---

## 🎯 Próximos Pasos

1. **Dominio Custom:**
   - Vercel → Settings → Domains
   - Agregar tu dominio
   - Configurar DNS

2. **SSL/HTTPS:**
   - Automático con Vercel
   - Certificado gratuito

3. **CI/CD:**
   - Ya configurado automáticamente
   - Cada push = nuevo deploy

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los **logs** en Vercel Dashboard
2. Verifica **Build Logs** para errores
3. Consulta [Vercel Docs](https://vercel.com/docs)

---

## 🎉 ¡Deploy Completado!

Tu aplicación ahora está:
- ✅ En producción
- ✅ Con HTTPS
- ✅ En CDN global
- ✅ Con deploys automáticos

**URL de Producción:** Verifica en tu Vercel Dashboard

---

**Última actualización:** 16 de Diciembre de 2025  
**Versión:** 1.0.0

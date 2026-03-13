# TFG – Guía rápida de configuración y uso

Este repositorio contiene:
- `docs/memoria/` → memoria del TFG en LaTeX
- `src/` → código del proyecto

El objetivo es poder trabajar desde cualquier ordenador usando GitHub y compilar la memoria fácilmente.

---

# 1. Requisitos

Instalar en Ubuntu / WSL:

```
sudo apt update
sudo apt install -y make latexmk biber inotify-tools \
texlive-latex-base texlive-latex-recommended texlive-latex-extra \
texlive-fonts-recommended texlive-lang-spanish
```

Esto instala todo lo necesario para compilar la memoria.

---

# 2. Compilar la memoria

Ir a la carpeta:

```
cd docs/memoria
```

Compilar:

```
make
```

Limpiar archivos temporales:

```
make clean
```

El PDF generado será:

```
tf.pdf
```

---

# 3. Autocompilación al guardar

Para recompilar automáticamente cuando cambies un `.tex`:

```
cd docs/memoria
./auto.sh
```

Deja esa terminal abierta mientras trabajas.

---

# 4. Configuración recomendada de VS Code

Instalar extensiones:

- LaTeX Workshop
- WSL (si usas Windows)

Abrir el proyecto desde WSL:

```
code .
```

Abrir el PDF con:

```
LaTeX Workshop: View LaTeX PDF
```

Atajos útiles:

- `Ctrl + click` en PDF → ir al código
- `Ctrl + Alt + J` → ir del código al PDF

---

# 5. Configurar GitHub en un dispositivo nuevo

### 1. Crear clave SSH

```
ssh-keygen -t ed25519 -C "tu_email"
```

Añadir la clave al agente:

```
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

Mostrar la clave pública:

```
cat ~/.ssh/id_ed25519.pub
```

Copiarla en GitHub:

```
Settings → SSH and GPG Keys → New SSH Key
```

Probar conexión:

```
ssh -T git@github.com
```

---

# 6. Clonar el repositorio

```
git clone git@github.com:TU_USUARIO/TU_REPO.git
cd tfg
```

---

# 7. Flujo básico de trabajo con Git

Ver estado:

```
git status
```

Actualizar repo:

```
git pull
```

Guardar cambios:

```
git add -A
git commit -m "mensaje del cambio"
```

Subir cambios:

```
git push
```

---

# 8. Crear ramas (opcional)

Crear rama:

```
git switch -c nombre-rama
```

Subir rama:

```
git push -u origin nombre-rama
```

Volver a main:

```
git switch main
```

---

# 9. Buenas prácticas

- Ejecutar `git pull` antes de empezar a trabajar
- Hacer commits pequeños y frecuentes
- No subir archivos de compilación (`build`, `.aux`, `.log`, etc.)

El `.gitignore` del repositorio ya evita subir estos archivos.

---

# 10. Estructura del proyecto

```
tfg
 ├── docs
 │   └── memoria
 │       ├── tf.tex
 │       ├── img
 │       ├── code
 │       ├── Makefile
 │       └── auto.sh
 │
 └── src
     └── código del proyecto
```

---

Con esta configuración puedes:
- trabajar desde varios ordenadores
- compilar la memoria fácilmente
- mantener todo sincronizado con GitHub


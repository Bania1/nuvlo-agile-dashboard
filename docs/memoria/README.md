Plantilla para TFG y TFM en Latex creada por Antonio Araúzo Azofra para la EPSC de la Universidad de Córdoba.

# Usar con tu editor

Puedes usar el Makefile para compilar el Latex. Permite automatizar algunas cosas y solo hay que hacerle algunos cambios cuando se añade un fichero nuevo.

Puedes usar auto.sh que ejecuta el Makefile automáticamente cuando grabes los cambios en algún fichero Latex relevante. Así puedes tener el visor de pdf abierto y el editor. Al darle a grabar se actualiza la visualización del PDF.

```
./auto.sh
```

# Overleaf y Git

Para usar esta plantilla en Overleaf y con git en local, seguid las instrucciones de [How do I push an new project to Overleaf via git](https://www.overleaf.com/learn/how-to/How_do_I_push_a_new_project_to_Overleaf_via_git%3F):

 1. Crear repositorio en Overleaf y copiar el link de git clone
 1. `cp -a plantilla-TFG-EPSC tfg-Nombre`
 1. `cd tfg-Nombre`
 1. `git init`
 1. `git remote add overleaf https://username%40micorreo.`com`@git.overleaf.com/...`
 1. `git pull overleaf master --allow-unrelated-histories`
 1. `git revert --mainline 1 HEAD`
 1. `git add .`
 1. `git commit -m 'Plantilla inicial'`
 1. `git push overleaf master`



XXX Check:
 - textit or emph for all english (look to spellcheck underline)
 - comprobar que todas las iniciales han sido introducidas: buscar varias mayúsculas seguidas, y verificar.
 - Probar que nada importante se sale con setframe en geometry

XXX TODO en plantilla:
 - cambiar la imagen de ejemplo para que sea vectorial
 - explicar contenido proyecto segun norma/nuestra recomendación
 - explicar detalles de estilo como figuras vectoriales...?
 - mover las figuras a carpeta portada y ver como dejar los ejemplos (si crear carpeta o sueltos)
 - revisar el ejemplo de casos de uso. Eliminar los espacios excesivos en el enumerate y poner las líneas elegantes midrule etc...
 - ver: https://es.overleaf.com/latex/templates/plantilla-tfg-epsc-uco/qgzdnrczjqtv
 
 XXX Notas para hacer documentación de lo que debería ir en cada apartado:
 
 - En todo el capítulo descripción del problema se está describiendo la situación actual. Nunca la solución, ni los objetivos, ni los requisitos, ni lo que necesita el usuario para usar el resultado del proyecto. Ver sobre cada sub-apartado del proyecto:
    - Calidad: La idea es más bien analizar qué calidad se necesita en este problema. Pensar en cosas como ¿cómo de contento estará el estudiante si la aplicación se cuelga? ¿que pasa si asigna una calificación erronea? ¿hay algún riesgo que afecte a la seguridad vital? ¿hay algún riesgo económico? Eso es lo que determina el nivel de calidad esperado y lo que se espera que se comente aquí.
 - Los objetivos, factores dato y factores estratégicos con categorias exclusivas. Un detalle puede estar sólo en una de ellas (si algo es un factor dato no es estratégico ni objetivo).

XXX Explicación de por qué usar vectoriales:
PNG es mapa de pixeles. Es muy dificil que la resolución sea la misma que la de impresión. Por tanto, siempre hay un reescalado con perdida de nitidez. Si es de una resolución grande a una más pequeña se nota poco. Al revés se nota mucho.

Los vectoriales son líneas y, por tanto, se ven siempre con la máxima calidad ajustada exactamente a la resolución con la que se imprime.


XXX Meter explicaciones sobre contenidos:
 
Identificación del problema técnico

2.2.1. Funcionamiento
XXX Funcionamiento de los procesos que se hacen ahora. Sin informatizar
2.2.2. Entorno
XXX Cómo es el entorno que pretendemso informatizar. Que sabe la gente que trabaja en ese entorno. Qué actividad tienen. Necesitan cosas que puedan llevar encima (papel, móvil) o están sentados en una mesa donde puede haber una pantalla muy grande….
2.2.3. Vida esperada
XXX Cuanto tiempo se espera que funcione el entorno tal cual. Sin cambios, es una feria que se va a hacer una vez y fin. Es una empresa que se espera que funcione para siempre sin cambios. Es una empresa que dentro de 3 años necesitará una restructuración. Una mina que se va a acabar en 5 años…. ¿¿¿???? 
2.2.4. Ciclo de mantenimiento
XXX Hay huecos sin actividad apra mantenimiento (noches, vacaciones) en las que nadie trabaja. ?? Cada x tiempo se revisa o se hace algún mantenimiento limpieza de la oficina??? Se necesita 24/7 y hay que pensar en un mantenimiento online.
2.2.5. Competencia
XXX Qué hace la competencia de nuestro cliente? o de nuestro sistema?
2.2.6. Aspecto externo
XXX Es importante la estética en nuestro entorno? Es importante la resistencia a impactos/suciedad?
2.2.7. Estandarización
XXX ¿qué estándares debemos seguir para el desarrollo de este problema? ¿es un entorno web cara al publico? ¿hay normas de contabilidad a calcular? ¿hay estándares sobre conexiónes, funcionamiento, leyes que obliguen a algo …. ?
2.2.8. Calidad y Fiabilidad
XXX ¿Qué nivel de clidad/fiabilidad necesita nuestro cliente?

XXX Evitar que aparezca la función docente. No se deben explicar cosas básicas. Es un documento técnico sobre el proyecto que se está desarrollando. Si se cree necesario incluir esa información, mejor en anexos o similar. O como introducción/motivación breve pero entonces debe ser redacción própia.

XXX Citar adecuadamente entre "" y con su referencia.


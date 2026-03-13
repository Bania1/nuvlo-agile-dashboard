# Compilar Latex
#
# Este make file ha sido desarrollado en una Debian
# Paquetes necesarios o recomendados:
#  -Latex: texlive-latex-base, texlive-latex-extra
#  -Figuras: transfig, netpbm, dia, graphviz, inkscape (for SVG to PDF conversion)
#
# © Antonio Arauzo-Azofra 2009-2025
.PHONY = all clean
SHELL = /bin/bash

# Nombre sin extension del principal
BASENAME = tf

# Si hay ficheros adicionales que motiven recompilar listar aquí
FUENTES = project.sty \
biblio.bib \
000_cover.tex \
002_resumen.tex \
005_Agradecimientos.tex \
011_Introduccion.tex \
021_Definicion-Problema.tex \
071_Requisitos.tex \
311_AnexoA.tex \
321_AnexoManualUsuario.tex \
331_AnexoManualCodigo.tex

IMAGENES = \
#    img/prelacionesLE.pdf \

all :	$(BASENAME).pdf

# --- Generacion del articulo principal ---
OUTDIR = build

$(OUTDIR):
	mkdir -p $(OUTDIR)

$(BASENAME).pdf : $(BASENAME).tex $(FUENTES) $(IMAGENES) | $(OUTDIR)
	@echo "----- LATEX 1 (create aux for bibliography) -----"
	pdflatex -synctex=1 -interaction=nonstopmode -file-line-error -output-directory=$(OUTDIR) $<
	@echo "----- BIBER -----"
	biber --input-directory $(OUTDIR) --output-directory $(OUTDIR) $(BASENAME)
	@echo "----- LATEX 2 (get bibliography cites) -----"
	pdflatex -synctex=1 -interaction=nonstopmode -file-line-error -output-directory=$(OUTDIR) $<
	@echo "----- LATEX 3 (rerun to get cross-references right) -----"
	pdflatex -synctex=1 -interaction=nonstopmode -file-line-error -output-directory=$(OUTDIR) $<
	@cp $(OUTDIR)/$(BASENAME).pdf .
	@cp $(OUTDIR)/$(BASENAME).synctex.gz .

# --- Conversiones de imágenes y figuras ---
%.pdf : %.odg
	libreoffice --headless --convert-to pdf --outdir $(dir $<) $<
	pdfcrop $@
	mv $(@:.pdf=-crop.pdf) $@

%.eps : %.tex
	latex $<
	dvips -E $(<:.tex=.dvi) -o $(<:.tex=.ps)
	mv $(<:.tex=.ps) $@
	rm -f $(<:.tex=.aux) $(<:.tex=.log) $(<:.tex=.dvi) $(<:.tex=.ps)*

%.pdf : %.dot
	dot -Tpdf $< -o $@

%.png : %.dia
	dia -t png -e $@ $<

%.eps : %.dia
	dia -t eps -e $@ $<

%.eps : %.fig
	fig2dev -L eps $< $@

%.pdf : %.eps
	epstopdf $<

%.png :	%.fig
	fig2dev -L png $< $@

#%.eps : %.png
#	pngtopnm $< | pnmtops >$@

%.png : %.eps
	epstopng $<

%.png : %.pdf
	pdftoppm $< $<; pnmtopng $<-1.ppm >$@
	rm $<-*

%.pdf : %.svg
	inkscape -z --file=$< --export-pdf=$@

# Limpiar el directorio de ficheros generados automáticamente
clean :
	rm -f *.ps *.dvi *.log *~ *.aux *.out *.bbl *.blg *.toc *.lof *.lot *.lox *.spl *.idx *.bcf *.run.xml
	rm -f *.mtc *.mtc? *.maf *.fdb_latexmk *.fls *.synctex.gz
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.tex} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.dot} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.dia} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.fig} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.eps} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.pdf; do if [ -f $${f/%.pdf/.svg} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.eps; do if [ -f $${f/%.eps/.tex} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.eps; do if [ -f $${f/%.eps/.dot} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.eps; do if [ -f $${f/%.eps/.dia} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.eps; do if [ -f $${f/%.eps/.fig} ]; then rm $${f}; fi; done
	shopt -s nullglob; for f in *.png; do if [ -f $${f/%.png/.fig} ]; then rm $${f}; fi; done
	rm -rf build
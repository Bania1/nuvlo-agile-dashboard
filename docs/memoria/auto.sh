#!/bin/bash
#
# Automatically watch tex source files and call make on the specified goals, given as arguments
#
# Note: when using this script in an Overleaf repository it will remove exec permission. It can be started with:
#       . ./auto.sh
#
# © Antonio Arauzo-Azofra
shopt -s nullglob    # ignore non existing files in pattern expansion
while true
do
    inotifywait -e close_write *.tex *.bib *.sty
    sleep 0.5s
    make $@
done

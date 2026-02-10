#!/bin/bash
git clone https://github.com/Yoshie2000/ChessTournamentViewer.git tmp
cd tmp
npm install stockfish
cp node_modules/stockfish/src/stockfish-17.1-single-a496a04* ../public
cd ..
rm -rf tmp
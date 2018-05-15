'use strict';

import * as vscode from 'vscode';
import * as data from 'emoji-datasource';

interface Emoji {
	short_name: string;
	sheet_x: number;
	sheet_y: number;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "emoji" is now active!');

	const emojiData: Emoji[] = <any>data;
	console.log(emojiData);
	const mappedEmoji: {[id: string]: Emoji} = {};
	let size: [number, number] = [0, 0];
	for (let emoji of emojiData) {
		// Map emoji to their short name
		mappedEmoji[emoji.short_name] = emoji;
		// Compute the size of the image (in number of emojis horizontally and vertically)
		size[0] = Math.max(size[0], emoji.sheet_x);
		size[1] = Math.max(size[1], emoji.sheet_y);
	}

	const url = context.asAbsolutePath('node_modules/emoji-datasource/img/emojione/sheets/32.png');

	const renderOptions: vscode.ThemableDecorationInstanceRenderOptions = {
		before: {
			contentText: '',
			textDecoration: 'none; display: inline-block; width: 1em; height: 1em; background-image: url("file:///'+ url.replace(/\\/g, '/') + '"); background-size: 5400%;',
		},
	};

	const decorationType = vscode.window.createTextEditorDecorationType({
		light: renderOptions,
		dark: renderOptions,

		textDecoration: 'none; display: none;',
	});

	let activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	var timeout: any = null;
	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(updateDecorations, 500);
	}

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		const regex = /:[^:]+:/g;
		const text = activeEditor.document.getText();
		const decorations: vscode.DecorationOptions[] = [];
		let match;
		while (match = regex.exec(text)) {
			const startPosition = activeEditor.document.positionAt(match.index);
			const endPosition = activeEditor.document.positionAt(match.index + match[0].length);

			// Remove the beginning and ending colon
			const emojiShortName = match[0].substr(1, match[0].length - 2);

			if (!mappedEmoji[emojiShortName]) {
				continue;
			}

			const x = mappedEmoji[emojiShortName].sheet_x / (size[0]+1)*100;
			const y = mappedEmoji[emojiShortName].sheet_y / (size[1])*100;

			const override = {
				before: {
					fontStyle: 'none; background-position: ' + x + '% ' + y + '%;'
				},
			};

			const decoration: vscode.DecorationOptions = {
				range: new vscode.Range(startPosition, endPosition),
				renderOptions: {
					light: override,
					dark: override,
				}
			};

			decorations.push(decoration);
		}

		activeEditor.setDecorations(decorationType, decorations);
	}
}

export function deactivate() {
}

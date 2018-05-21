import {window, workspace, ExtensionContext, Uri, Range, TextEditor, DecorationRangeBehavior, TextEditorDecorationType} from 'vscode';
import * as emojione from 'emoji-datasource-emojione';

type HashMap<T> = {[key: string] : T};
const emojis = emojione as emojione.Emoji[];

export function activate(context: ExtensionContext) {
	console.log('Congratulations, your extension "emoji" is now active!');

	const emojiUnicodeRegex = require('emoji-regex')();
	const emojiShortCodeRegex = /:([^:\s]+):/g;

	let mappedEmojiShortNameToUnicode: HashMap<string> = {};
	let mappedEmojiUnicodeURL: HashMap<string> = {};
	let knownEditors: [TextEditor, HashMap<Range[]>][] = [];
	let decorators: HashMap<TextEditorDecorationType> = {};
	let timeout: any;

	for (let emoji of emojis) {
		const path = context.asAbsolutePath('node_modules/emoji-datasource-emojione/img/emojione/64/' + emoji.image);
		const url = Uri.file(path).toString();
		const unicode = unifiedToUnicode(emoji.unified);
		mappedEmojiShortNameToUnicode[emoji.short_name] = unicode;
		mappedEmojiUnicodeURL[unicode] = url;
	}

	function getDecorator(unicode: string) {
		if (!decorators[unicode]) {
			decorators[unicode] = window.createTextEditorDecorationType({
				textDecoration: 'none; background-image: url("'+ mappedEmojiUnicodeURL[unicode] + '"); '
								+ 'background-repeat: no-repeat; background-position: center; '
								+ 'background-size: 1em; width: 1em; display: inline-block; /*overflow: hidden;*/',
				rangeBehavior: DecorationRangeBehavior.ClosedClosed,
				letterSpacing: '-0.4em', // TODO(tom@tomrochette.com): We probably do not want this for unicode
				color: 'transparent',
			});
		}

		return decorators[unicode];
	}

	function getDecoratorByUnicode(unicode: string) {
		if (!mappedEmojiUnicodeURL[unicode]) {
			return null;
		}

		return getDecorator(unicode)
	}

	function unifiedToUnicode(value: string) {
		let unicode = '';
		let parts = value.split('-');
		for (let part of parts) {
			unicode += String.fromCodePoint(parseInt(part, 16));
		}
		return unicode;
	}

	function updateDecorations(textEditor: TextEditor|undefined, delay: number = 250) {
		if (timeout) {
			clearTimeout(timeout);
		}

		if (!textEditor) {
			return;
		}

		timeout = setTimeout(() => {
			let editor = knownEditors.find(v => v[0] == textEditor);

			if (!editor) {
				knownEditors.push([textEditor, {}]);
				editor = knownEditors[knownEditors.length - 1];
			}

			let [, ranges] = editor;

			// TODO(tom@tomrochette.com): Do not reset everything, just those that were touched by the edit
			for (let key in ranges) {
				ranges[key] = [];
			}
			let text = textEditor.document.getText();
			let match;

			emojiShortCodeRegex.lastIndex = 0;
			while (match = emojiShortCodeRegex.exec(text)) {
				let startPosition = textEditor.document.positionAt(match.index);
				let endPosition = textEditor.document.positionAt(match.index + match[0].length);
				let range = new Range(startPosition, endPosition);
				let short_name = match[1];
				let unicode = mappedEmojiShortNameToUnicode[short_name];

				ranges[unicode] = ranges[unicode] || [];
				ranges[unicode].push(range);
			}

			emojiUnicodeRegex.lastIndex = 0;
			while (match = emojiUnicodeRegex.exec(text)) {
				let startPosition = textEditor.document.positionAt(match.index);
				let endPosition = textEditor.document.positionAt(match.index + match[0].length);
				let range = new Range(startPosition, endPosition);
				let unicode = match[0];

				ranges[unicode] = ranges[unicode] || [];
				ranges[unicode].push(range);
			}

			for (let key in ranges) {
				let decorator = getDecoratorByUnicode(key);

				if (decorator) {
					textEditor.setDecorations(decorator, ranges[key]);
				}
			}
		}, delay);
	}


	context.subscriptions.push(
		window.onDidChangeActiveTextEditor(editor => {
			updateDecorations(editor, 0);
		}),
		workspace.onDidChangeTextDocument(event => {
			let editor = knownEditors.find(v => v[0] == window.activeTextEditor);

			if (editor) {
				let activeDecorations = editor[1];

				for (let change of event.contentChanges) {
					let line = change.range.start.line;

					// Has an emoji in it
					if (emojiUnicodeRegex.exec(change.text)) {
						updateDecorations(window.activeTextEditor, 0);
						return;
					}

					// Updating what looks like a short name
					if (change.text.indexOf(':') > -1 || (change.range.isSingleLine && event.document.lineAt(line).text.indexOf(':') > -1)) {
						updateDecorations(window.activeTextEditor, 0);
						return;
					}
				}

				for (let key in activeDecorations) {
					for (let knownRange of activeDecorations[key]) {
						if (event.contentChanges.filter(range => range.range.intersection(knownRange)).length > 0) {
							updateDecorations(window.activeTextEditor, 0);
							return;
						}
					}
				}
			}
		}),
	);

	updateDecorations(window.activeTextEditor);
}

export function deactivate() {
}

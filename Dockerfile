# Node.js公式イメージから始める（バージョンは自由）
FROM node:18

# アプリ作業ディレクトリを作る
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー（キャッシュ効率化）
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# アプリの全ファイルをコピー
COPY . .

# Cloud Run は 8080番ポートを使用
EXPOSE 8080
ENV PORT=8080

# アプリ起動（package.jsonの "start": "node index.js" を使う）
CMD ["npm", "start"]

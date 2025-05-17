const express = require('express');     // Webサーバー構築用フレームワーク
const axios = require('axios');         // HTTPリクエスト送信用（GitHubとやりとり用）
const cors = require('cors');           // CORS（別ドメインからのアクセス制御）
const { Pool } = require('pg');         // PostgreSQLに接続するためのモジュール
const dotenv = require('dotenv');       // .envファイルから環境変数を読み込む

dotenv.config();                        // .env読み込みを実行

const app = express();
app.use(cors());                        // 開発中は全ドメイン許可（本番では制限すべき）
app.use(express.json());                // JSONボディを自動で解析できるようにする

// 環境変数の取得
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const DB_URL = process.env.DB_URL;
const REACT_REDIRECT = process.env.REACT_REDIRECT;//http://localhost:3000/callbackというようにフロントのポートを指定する
const FLUTTER_REDIRECT = process.env.FLUTTER_REDIRECT;

// PostgreSQL接続プールを作成
const pool = new Pool({ connectionString: DB_URL });

app.get('/login/github', (req, res) => {
  const { platform } = req.query;
 const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=https://engineer-sns-436152672971.europe-west1.run.app/callback/github?platform=${platform}`;
  res.redirect(redirectUrl); // GitHubのログイン画面にリダイレクト
});


//　'/login/github'から
//　/callback/github?platform=flutter&code=abc123を受けとっている
app.get('/callback/github', async (req, res) => {
  const code = req.query.code;                 // GitHubが付けてくる一時コード
  const platform = req.query.platform || 'web';// クエリで受け取った platform（web or flutter）

  try {
    // GitHubにアクセストークンを要求する
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const access_token = tokenRes.data.access_token;

    // アクセストークンを使ってGitHubユーザー情報を取得
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userRes.data;
    if (!user.id) return res.status(401).send('GitHub認証失敗');

    // DBにユーザー情報を登録（または更新）
    const client = await pool.connect();
    await client.query(`
      INSERT INTO users (github_id, user_name, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (github_id) DO UPDATE
      SET user_name = EXCLUDED.user_name,
          avatar_url = EXCLUDED.avatar_url
    `, [user.id, user.login, user.avatar_url]);
    client.release();

    // フロントに返すデータ（クエリ文字列として付加）
    const query = new URLSearchParams({
      id: user.id,
      name: user.login,
      avatar: user.avatar_url,
    }).toString();//なくても動く

    // React or Flutter どちらに返すかを分岐
    const redirectTo = platform === 'flutter'
      ? `${FLUTTER_REDIRECT}?${query}`//フロントのポートを入れてるのでフロントに帰れる
      : `${REACT_REDIRECT}?${query}`;//セキュリティ的によくないので、クエリ文字列は使わないほうがいい

    // フロントにリダイレクト
    res.redirect(redirectTo);

  } catch (e) {  // ↑でエラーが出たとき、ここに飛んでくる
    console.error(e);  // エラー内容をログに出す
    res.status(500).send('サーバーエラー');// フロントに「500エラーです」と伝える
  }
});

// サーバー起動
const PORT = process.env.PORT;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`サーバーが起動しました → ${PORT}`);
  console.log(`サーバーが起動しませんでした → ${PORT}`);
});

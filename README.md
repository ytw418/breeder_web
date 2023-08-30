```bash
npm install prisma --save-dev
npx prisma
npx prisma init

brew -v // brew 설치 필요 설치 확인
brew install planetscale/tap/pscale
brew install mysql-client
brew upgrade pscale

pscale auth login
pscale org switch <ORGANIZATION_NAME> <= 선택 *** 조직을 하나 이상 생성 했을때 ex: pscale org switch breeder or ytw418
pscale connect <너의 pscale db 이름> ex: pscale connect breeder_db

- DATABASE_URL="mysql://127.0.0.1:57520/<db name>


npx prisma db push
npx prisma studio

npm install @prisma/client
npx prisma generate
```

<div align="center">

# 그린체크 (GreenCheck)
고지서 한 장에서 시작하는, 소상공인·가구·기후 취약계층을 위한 통합 기후·에너지 자가진단 플랫폼
</div>

<br/>

## 🙋🏻‍♀️ GreenCheck의 BE Developer를 소개합니다!

| <a href="https://github.com/yeon-yeon1"><img src="https://avatars.githubusercontent.com/u/158417764?v=4" width="120px;" alt=""/></a> |
| ------------------------------------------------------------------------------------------------------------------------------------ |
| 노진경                                                                                                                               |

<br>

## 📊 Insights

![Analytics](https://repobeats.axiom.co/api/embed/be69083abeafa3d0611099510dc97b2082297152.svg "Repobeats analytics image")

## 📚 서비스 소개

**그린체크(GreenCheck)** 는 고지서 한 장에서 시작하는, 소상공인·가구·기후 취약계층을 위한 통합 기후·에너지 자가진단 플랫폼입니다.
<br>
복잡한 에너지 사용 정보를 고지서만으로 간단히 진단하고, 기후 위기에 취약한 대상이 스스로 에너지 효율과 위험도를 점검할 수 있도록 설계되었습니다.

## 💻 기술 스택

| **역할**             | **종류**                                                                                                                                                                                                | **선정 이유**                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Framework            | <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white">                                                                                                  | 모듈/DI 기반의 구조화된 아키텍처를 기본 제공해 협업 시 코드 일관성을 유지하기 쉽고, 확장에 유리          |
| Programming Language | <img src="https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>                                                                                          | 정적 타입을 제공하여 코드의 안정성과 가독성을 높이고, 개발 중 오류를 사전에 방지할 수 있어 유지보수에 유리 |
| ORM                  | <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white">                                                                                                  | 스키마 기반 타입 안전성과 직관적인 마이그레이션 관리로 DB 작업 시 런타임 오류를 줄일 수 있음             |
| Database             | <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">                                                                                          | 오픈소스 생태계와 Prisma 지원이 가장 대중적인 관계형 DB로, 안정성과 확장성이 검증됨                      |
| Package Manager      | <img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white">                                                                                                       | 빠른 설치 속도와 디스크 공간을 절약하는 효율적인 의존성 관리로 프로젝트 환경 설정에 용이                 |
| Formatting           | <img src="https://img.shields.io/badge/eslint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white"> <img src="https://img.shields.io/badge/prettier-000000?style=for-the-badge&logo=prettier&logoColor=F7B93E"> | 코드 스타일을 통일하고 잠재적인 오류를 사전에 방지하여 협업 시 효율성을 높임                             |
| Testing              | <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white">                                                                                                      | NestJS 공식 권장 테스트 러너로, 단위/E2E 테스트를 별도 설정 없이 바로 사용 가능                          |

<br>

## 🧩 Package Manager

- **pnpm 버전**
  - 10.12.1 (`package.json`의 `packageManager` 필드로 고정)

- **pnpm 버전 변경 방법**

```
corepack use pnpm@버전 # 프로젝트 최상위 폴더 위치에서 명령어 입력
```

- **pnpm 명령어 예시**

```
pnpm install # 전체 설치
pnpm add 라이브러리 # 라이브러리 설치
pnpm run start:dev # 개발 서버 실행 (watch mode)
pnpm run build # 프로덕션 빌드
pnpm run lint # ESLint 검사
pnpm run format # Prettier 전체 포맷
pnpm test # Jest 단위 테스트 실행
pnpm run test:e2e # Jest E2E 테스트 실행
```

<br>

## 🗄️ Prisma / Database

- **로컬 PostgreSQL 준비 (최초 1회)**

```
brew install postgresql@16
brew services start postgresql@16

psql postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"
psql postgres -c "CREATE DATABASE glgc OWNER postgres;"
```

- `.env`의 `DATABASE_URL`이 위에서 만든 DB를 가리키는지 확인하세요 (`.env.example` 참고).

- **명령어**

```
npx prisma generate # 스키마 변경 후 Prisma Client 재생성
npx prisma migrate dev # 로컬 DB에 마이그레이션 적용 및 생성
npx prisma studio # DB GUI 실행
```

- 스키마는 `prisma/schema.prisma`에서 관리합니다.
- Prisma Client는 `src/generated/prisma`에 생성되며, git에는 포함되지 않습니다 (`pnpm install` 또는 스키마 변경 후 `npx prisma generate`로 생성).

<br>

## 🔐 환경변수

`.env.example`을 복사해 `.env`를 만들고 실제 값을 채워주세요. `.env.example`만 git에 커밋됩니다.

<br>

## ⌨️ Code Styling

- **camelCase**
  - 변수명, 함수명에 적용
  - 첫글자는 소문자로 시작, 띄어쓰기는 붙이고 뒷 단어의 시작을 대문자로
    - ex- handleDelete
  - 언더바 사용 X (클래스명은 허용)

<br>

## 🎉Git Convention

### 📌 Git Flow

```
develop ← 작업 브랜치
```

- `main branch` : 배포 브랜치
- `develop branch` : 개발 브랜치, feature 브랜치가 merge됨
- `feature branch` : 도메인/기능(API) 브랜치

  <br>

### ✨ Flow

- `develop 브랜치`에서 새로운 브랜치를 생성.
- 작업을 완료하고 커밋 메시지에 맞게 커밋.
- Pull Request 생성
- `develop` 브랜치로 병합.

<br>

### 🔥 Commit Message Convention

- **커밋 유형**
  - 🎉 Init: 프로젝트 세팅
  - ✨ Feat: 새로운 기능 추가
  - 🐛 Fix : 버그 수정
  - 🗃️ DB : DB 스키마/마이그레이션 변경
  - ✅ Test : 테스트 코드 추가/수정
  - ✏️ Typing Error : 오타 수정
  - 📝 Docs : 문서 수정
  - 🚚 Mod : 폴더 구조 이동 및 파일 이름 수정
  - 💡 Add : 파일 추가
  - 🔥 Del : 파일 삭제
  - ♻️ Refactor : 코드 리펙토링
  - 🚧 Chore : 배포, 빌드 등 기타 작업
  - 🔀 Merge : 브랜치 병합

- **형식**: `커밋유형: 상세설명`
- **예시**:
  - 🎉 Init: 프로젝트 초기 세팅
  - ✨ Feat: 로그인 API 개발

<br>

### 🌿 Branch Convention

**Branch Naming 규칙**

- **브랜치 종류**
  - `init`: 프로젝트 세팅
  - `feat`: 새로운 기능 추가
  - `fix` : 버그 수정
  - `refactor` : 코드 리펙토링

- **형식**: `브랜치종류/#이슈번호/상세기능`
- **예시**:
  - init/#1/init
  - fix/#2/login-api

<br>

### 📋 Issue Convention

**Issue Title 규칙**

- **태그 목록**:
  - `Init`: 프로젝트 세팅
  - `Feat`: 새로운 기능 추가
  - `Fix` : 버그 수정
  - `Refactor` : 코드 리펙토링

- **형식**: [태그] 작업 요약
- **예시**:
  - [Init] 프로젝트 초기 세팅
  - [Feat] 로그인 API 구현

<br>

## 📂 프로젝트 구조

<!-- 기능이 추가되면서 폴더 구조는 계속 바뀔 수 있음 -->

```
📦GLGC_BE
 ┣ 📂prisma
 ┃ ┗ 📜schema.prisma
 ┣ 📂src
 ┃ ┣ 📂generated         (Prisma Client 자동 생성 - git 미포함)
 ┃ ┣ 📂prisma
 ┃ ┃ ┣ 📜prisma.module.ts
 ┃ ┃ ┗ 📜prisma.service.ts
 ┃ ┣ 📜app.controller.ts
 ┃ ┣ 📜app.controller.spec.ts
 ┃ ┣ 📜app.module.ts
 ┃ ┣ 📜app.service.ts
 ┃ ┗ 📜main.ts
 ┣ 📂test
 ┃ ┣ 📜app.e2e-spec.ts
 ┃ ┗ 📜jest-e2e.json
 ┣ 📜.env.example
 ┣ 📜.gitignore
 ┣ 📜.prettierrc
 ┣ 📜eslint.config.mjs
 ┣ 📜nest-cli.json
 ┣ 📜package.json
 ┣ 📜pnpm-lock.yaml
 ┣ 📜prisma.config.ts
 ┣ 📜README.md
 ┣ 📜tsconfig.build.json
 ┗ 📜tsconfig.json
```

- prisma - `schema.prisma`에 DB 모델 정의, 마이그레이션 파일 관리
- src
  - generated/prisma - `prisma generate`로 자동 생성되는 Prisma Client (직접 수정 X)
  - prisma - 전역으로 주입되는 `PrismaService` / `PrismaModule`
  - (추후 기능이 늘어나면 도메인별로 `*.module.ts` / `*.controller.ts` / `*.service.ts`를 `src` 하위에 추가)

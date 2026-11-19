// PM2 ecosystem — env_file로 .env 자동 로드
// script 는 cwd 기준 상대경로다(cwd 이름을 또 붙이면 경로가 겹쳐 'Script not found').
// 사용: pm2 start ecosystem.config.cjs  또는  pm2 reload ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name:     'medalbank-aquatics-api',
      script:   './index.js',
      cwd:      './server',
      env_file: '../.env',
    },
    {
      name:     'medalbank-aquatics-registry',
      script:   './.output/server/index.mjs',
      cwd:      './medalbank',
      env_file: '../.env',
      env: { PORT: '6631', NODE_ENV: 'production' },
    },
    {
      name:     'medalbank-aquatics-nuxt',
      script:   './.output/server/index.mjs',
      cwd:      './aquatics',
      env_file: '../.env',
      env: { PORT: '6632', NODE_ENV: 'production' },
    },
    {
      name:     'medalbank-aquatics-breaststroke',
      script:   './.output/server/index.mjs',
      cwd:      './breaststroke',
      env_file: '../.env',
      env: { PORT: '6633', NODE_ENV: 'production' },
    },
    {
      name:     'medalbank-aquatics-sse',
      script:   './.output/server/index.mjs',
      cwd:      './sse',
      env_file: '../.env',
      env: { PORT: '6634', NODE_ENV: 'production' },
    },
    // erp (API + 관리 화면). 코드는 server/erp 이지만 업무 시스템이라 별도 프로세스로 띄운다 (server 의 ERP_MOUNT 는 끈다).
    {
      name:     'medalbank-aquatics-erp',
      script:   './erp/index.js',
      cwd:      './server',
      env_file: '../.env',
      env: { ERP_PORT: '6643', NODE_ENV: 'production' },
    },
    // swimmingPhotography 공개 사이트 / 관리 대시보드. API 는 위 server(6630)의 /sp 로 프록시된다.
    {
      name:     'medalbank-aquatics-swimmingphotography',
      script:   './.output/server/index.mjs',
      cwd:      './swimmingPhotography',
      env_file: '../.env',
      env: { PORT: '6641', NODE_ENV: 'production' },
    },
    {
      name:     'medalbank-aquatics-swimmingphotography-dashboard',
      script:   './.output/server/index.mjs',
      cwd:      './swimmingPhotographyDashboard',
      env_file: '../.env',
      env: { PORT: '6642', NODE_ENV: 'production' },
    },
  ],
}

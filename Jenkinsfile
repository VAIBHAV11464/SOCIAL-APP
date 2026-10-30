pipeline {
    agent any
    options { skipDefaultCheckout(); timestamps(); disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '12')) }
    parameters { choice(name: 'VERSION', choices: ['v1', 'v2', 'v3'], description: 'Release tag to build, publish and deploy') }
    environment {
        VERSION = "${params.VERSION ?: 'v1'}"
        DOCKER_USER = 'vaibhav11464'
        IMAGE_NAME = 'social-app'
        DOCKER_HOST = 'npipe:////./pipe/dockerDesktopLinuxEngine'
        PATH = "C:\\Program Files\\nodejs;D:\\Git\\cmd;C:\\Users\\vaibh\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin;${env.PATH}"
    }
    stages {
        stage('Checkout release') {
            steps {
                checkout([$class: 'GitSCM', branches: [[name: "refs/tags/${params.VERSION}"]], userRemoteConfigs: [[url: 'https://github.com/VAIBHAV11464/SOCIAL-APP.git']], extensions: [[$class: 'CloneOption', noTags: false, shallow: false]]])
                powershell 'git log -1 --oneline; Get-Content release.json; if ((Get-Content release.json | ConvertFrom-Json).version -ne $env:VERSION) { throw "Release tag and application version differ" }'
            }
        }
        stage('Test application') {
            steps { bat 'call npm.cmd ci --ignore-scripts && call npm.cmd run check && call npm.cmd test' }
        }
        stage('Build Docker image') {
            steps {
                bat "for /f %%i in ('git rev-parse HEAD') do docker build --label org.opencontainers.image.revision=%%i -t %DOCKER_USER%/%IMAGE_NAME%:%VERSION% ."
                bat 'docker run --rm %DOCKER_USER%/%IMAGE_NAME%:%VERSION% npm test'
            }
        }
        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'social-dockerhub', usernameVariable: 'HUB_USER', passwordVariable: 'HUB_TOKEN')]) {
                    withEnv(["DOCKER_CONFIG=${env.WORKSPACE}\\.pipeline-docker"]) {
                        script {
                            try {
                                bat """@echo off
node -e "const r=require('child_process').spawnSync('docker',['login','--username',process.env.HUB_USER,'--password-stdin'],{input:process.env.HUB_TOKEN+String.fromCharCode(10),stdio:['pipe','inherit','inherit']});process.exit(r.status===0?0:1)"
"""
                                bat 'docker push %DOCKER_USER%/%IMAGE_NAME%:%VERSION%'
                            } finally {
                                dir('.pipeline-docker') { deleteDir() }
                            }
                        }
                    }
                }
            }
        }
        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([file(credentialsId: 'social-kubeconfig', variable: 'KUBECONFIG')]) {
                    powershell './scripts/deploy.ps1 -Version $env:VERSION -Image "$($env:DOCKER_USER)/$($env:IMAGE_NAME):$($env:VERSION)" -BuildId $env:BUILD_NUMBER'
                }
            }
        }
        stage('Verify deployed application') {
            steps {
                withCredentials([file(credentialsId: 'social-kubeconfig', variable: 'KUBECONFIG')]) {
                    powershell './scripts/verify.ps1 -Version $env:VERSION'
                }
            }
        }
    }
    post { success { echo "Release ${params.VERSION} was tested, published to Docker Hub and deployed successfully." } }
}

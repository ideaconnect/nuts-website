.PHONY: install-deps build

install-deps:
	bundle config set --local path 'vendor/bundle'
	bundle install
	npm install

build:
	npm run css:build
	JEKYLL_ENV=production bundle exec jekyll build

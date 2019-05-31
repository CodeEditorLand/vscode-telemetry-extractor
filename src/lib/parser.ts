import { rgPath } from 'vscode-ripgrep';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { Fragments } from './fragments';
import { Property, CommonProperties } from './common-properties';
import { Events } from './events';
import { Declarations } from './declarations';
import { merge, findOrCreate, populateProperties } from './operations';

export class Parser {

    private sourceDirs: string[];
    private excludedDirs: string[];
    private includeIsMeasurement: boolean;
    private applyEndpoints: boolean;

    constructor(sourceDirs: string[], excludedDirs: string[], includeIsMeasurement: boolean, applyEndpoints: boolean){
        this.sourceDirs = sourceDirs;
        this.excludedDirs = excludedDirs;
        this.includeIsMeasurement = includeIsMeasurement;
        this.applyEndpoints = applyEndpoints;
    }

    private toRipGrepOption(dir: string) {
        while (dir.startsWith('/')) {
            dir = dir.substr(1);
        }
        return `--glob "!${dir}/**" `;
    }

    private extractComments(absoluteFilePaths: string[], commentMatcher: RegExp, collector: Function) {
        absoluteFilePaths.forEach(absoluteFilePath => {
            if (absoluteFilePath) {
                const fileContents = fs.readFileSync (absoluteFilePath);
                let match;
                while (match = commentMatcher.exec(fileContents.toString())) {
                    collector(absoluteFilePath, match);
                }
            }
        });

    }
    
    // Converts relative paths to absolute utilizing the CWD
    private asAbsoluteFilePaths(relativeFilePaths: string[]) {
        return relativeFilePaths.map(r => path.resolve(r));
    }

    // Finds all files containing common telemetry properties in the given directory
    private findFilesWithCommonProperties(sourceDir: string) {
        const ripgrepPattern = '//\\s*__GDPR__COMMON__';
        return this.findFiles(ripgrepPattern, sourceDir);
    }

    private findCommonProperties(sourceDir: string) {
        const filesWithCommonProperties = this.asAbsoluteFilePaths(this.findFilesWithCommonProperties(sourceDir));

        const commonPropertyMatcher = /\/\/\s*__GDPR__COMMON__(.*)$/mg;
        const commonPropertyDeclarations = new CommonProperties();
        this.extractComments(filesWithCommonProperties, commonPropertyMatcher, (filePath: string, match: Array<string>) => {
            try {
                const commonPropertyDeclaration = JSON.parse(`{ ${match[1]} }`);
                const propertyName = Object.keys(commonPropertyDeclaration)[0];
                const properties = commonPropertyDeclaration[propertyName];
                // Add all the common properties to the common property object
                const prop = new Property(propertyName, properties.classification, properties.purpose);
                if (this.applyEndpoints) {
                    const endpoint = properties.endPoint ? properties.endPoint : 'none';
                    prop.endPoint = endpoint;
                }
                if (this.includeIsMeasurement && properties.isMeasurement) {
                    prop.isMeasurement = properties.isMeasurement;
                }
                commonPropertyDeclarations.properties.push(prop);
            } catch (error) {
                console.error(`Common Property Declaration Error: ${error} in file ${filePath}`);
                console.error(`Source comment:\n${match[0]}`);
            }
        });
        return commonPropertyDeclarations;
    }

    // Finds all files containing event fragments in the given directory
    private findFilesWithFragments(sourceDir: string) {
        const ripgrepPattern = '/\*\\s*__GDPR__FRAGMENT__';
        return this.findFiles(ripgrepPattern, sourceDir);
    }

    /// 
    private findFragments(sourceDir: string) {
        const filesWithFragments = this.asAbsoluteFilePaths(this.findFilesWithFragments(sourceDir));

        // Using [\s\S]* instead of .* since the latter does not match when using /m option
        const fragmentMatcher = /\/\*\s*__GDPR__FRAGMENT__([\s\S]*?)\*\//mg;
        const fragmentDeclarations = new Fragments();
        this.extractComments(filesWithFragments, fragmentMatcher, (filePath: string, match: Array<string>) => {
            try {
                const fragmentDeclaration = JSON.parse(`{ ${match[1]} }`);
                // There's only ever one key per match
                const fragmentName = Object.keys(fragmentDeclaration)[0];
                // Checks to see if we have a fragment of the given name, else creates.
                const fragment = findOrCreate(fragmentDeclarations, fragmentName);
                const fragmentProperties = fragmentDeclaration[fragmentName];
                populateProperties(fragmentProperties, fragment, this.applyEndpoints, this.includeIsMeasurement);
            } catch (error) {
                console.error(`Fragment Declaration Error: ${error} in file ${filePath}`);
                console.error(`Source comment:\n${match[0]}`);
            }
        });
        return fragmentDeclarations;
    }

    // Find all files with complete events
    private findFilesWithEvents(sourceDir: string) {
        const ripgrepPattern = '/\*\\s*__GDPR__\\b';
        return this.findFiles(ripgrepPattern, sourceDir);
    }

    private findEvents(sourceDir: string) {
        const filesWithEvents = this.asAbsoluteFilePaths(this.findFilesWithEvents(sourceDir));

        // Using [\s\S]* instead of .* since the latter does not match when using /m option
        const eventMatcher = /\/\*\s*__GDPR__\b([\s\S]*?)\*\//mg;
        const eventDeclarations = new Events();
        this.extractComments(filesWithEvents, eventMatcher, (filePath: string, match: Array<string>) => {
            try {
                const eventDeclaration = JSON.parse(`{ ${match[1]} }`);
                const eventName = Object.keys(eventDeclaration)[0];
                const event = findOrCreate(eventDeclarations, eventName);
                // Get the propeties which the event possesses
                const eventProperties = eventDeclaration[eventName];
                populateProperties(eventProperties, event, this.applyEndpoints, this.includeIsMeasurement);
            } catch (error) {
                console.error(`Event Declaration Error: ${error} in file ${filePath}`);
                console.error(`Source comment:\n${match[0]}`);
            }
        });
        return eventDeclarations;
    }

    // Utilizes a regex to find the files containing the specific pattern
    private findFiles(ripgrepPattern: string, sourceDir: string) {
        const exclusions = this.excludedDirs.length === 0 || this.excludedDirs[0] === '' ? '' : this.excludedDirs.map(this.toRipGrepOption).join('');
        const cmd = `${rgPath} --files-with-matches --glob "*.ts" ${exclusions} --regexp "${ripgrepPattern}" -- ${sourceDir}`;
        try {
            let filePaths = cp.execSync(cmd, { encoding: 'ascii', cwd: `${sourceDir}` });
            return filePaths.split(/(?:\r\n|\r|\n)/g).filter(path => path && path.length > 0);  
        } catch (err) {
            // ripgrep's return code != 0 if there are no matches
            return [];
        }
    }

    private async parse(sourceDir: string): Promise<Declarations> {
        const fragments = this.findFragments(sourceDir);
        const events = this.findEvents(sourceDir);
        const commonProperties = this.findCommonProperties(sourceDir);
        return {fragments: fragments, events: events, commonProperties: commonProperties};
    }

    public extractDeclarations(): Promise<Declarations> {
        return new Promise((resolve, reject) => {
            // Find all the properties for all files
            const promises  = this.sourceDirs.map(sd => this.parse(sd));
            // Now we must merge them into one superset of all declarations
            Promise.all(promises).then(parseResult => {
                const declarations = {fragments: new Fragments(), events: new Events(), commonProperties: new CommonProperties()};
                for (const currentResult of parseResult) {
                    merge(declarations.fragments, currentResult.fragments);
                    merge(declarations.events, currentResult.events);
                    // We just concatenate common properties
                    declarations.commonProperties.properties = declarations.commonProperties.properties.concat(currentResult.commonProperties.properties);
                }
                return resolve(declarations);
            });
        });
    }
}
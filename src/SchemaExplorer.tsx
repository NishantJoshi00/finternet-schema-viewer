import React from 'react';
import { JsonSchema, JsonSchema1 } from './schema';
import { getSchemaFromResult, Lookup } from './lookup';
import { ParameterView } from './Parameter';
import styled from 'styled-components';
import Button from '@atlaskit/button';
import ChevronLeftIcon from '@atlaskit/icon/glyph/chevron-left';
import LinkIcon from '@atlaskit/icon/glyph/link';
import { Markdown } from './markdown';
import { BreadcrumbsStateless, BreadcrumbsItem } from '@atlaskit/breadcrumbs';
import Tabs from '@atlaskit/tabs';
import { TabData, OnSelectCallback } from '@atlaskit/tabs/types';
import { CodeBlockWithCopy } from './code-block-with-copy';
import { generateJsonExampleFor, isExample } from './example';
import { Stage, shouldShowInStage } from './stage';
import { externalLinkTo, linkTo, PathElement } from './route-path';
import { ClickElement, Type, Anything } from './Type';
import { Link, LinkProps, useHistory, useLocation } from 'react-router-dom';
import { getTitle, findTitle } from './title';
import { LinkPreservingSearch, NavLinkPreservingSearch } from './search-preserving-link';
import { dump } from 'js-yaml';
import { isExternalReference } from './type-inference';
import { SchemaValidator } from './SchemaValidator';
import type { editor, IRange } from 'monaco-editor';

interface SEPHeadProps {
  basePathSegments: Array<string>;
  path: PathElement[];
  pathExpanded: boolean;
  onExpandClick: () => void;
}

const Head = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;

    margin: 0;
    padding: 0;
`;

const Path = styled.div`
    padding-left: 20px;

    a {
      color: inherit;
      text-decoration: none;
    }

    a.active {
      color: #0057d8;
    }
`;

function getObjectPath(basePathSegments: Array<string>, path: PathElement[]): JSX.Element[] {
  return path.map((pe, i) => (
    <BreadcrumbsItem
      key={`${pe.title}-${i}`}
      text={pe.title}
      component={() => (
        <NavLinkPreservingSearch to={linkTo(basePathSegments, path.slice(0, i+1).map(p => p.reference))}  exact={true}>
          {getTitle(pe.reference, { title: pe.title !== 'object' ? pe.title : undefined })}
        </NavLinkPreservingSearch>
      )}
    />
  ));
}

const BackButton: React.FC<LinkProps> = props => {
  const history = useHistory();
  return (
    <Button
      key="backButton"
      iconBefore={<ChevronLeftIcon label="Back" />}
      href={props.href}
      onClick={e => {
        e.preventDefault();
        history.push(props.href || '');
      }}
    >Back
    </Button>
  );
}

function init<A>(arr: Array<A>): Array<A> {
  if (arr.length === 0) {
    return arr;
  }

  return arr.slice(0, arr.length - 1);
}

const SEPHead: React.FC<SEPHeadProps> = (props) => {
  const onExpandClick = () => {
    props.onExpandClick();
  };

  const ActionButton = props.path.length <= 1
    ? <h1>Root</h1>
    : (
      <LinkPreservingSearch to={linkTo(props.basePathSegments, init(props.path.map(p => p.reference)))} component={BackButton} />
    );

  return (
    <Head>
      <div>{ActionButton}</div>
      <Path>
        <BreadcrumbsStateless
          isExpanded={props.pathExpanded}
          onExpand={onExpandClick}
        >
          {getObjectPath(props.basePathSegments, props.path)}
        </BreadcrumbsStateless>
      </Path>
    </Head>
  );
};

const Permalink: React.FC = () => {
  const location = useLocation();
  return (
    <Button
        appearance="link"
        href={location.pathname + location.search}
        iconBefore={<LinkIcon label="permalink" />}
      >Permalink
    </Button>
  );
};

type ExpandProps = {
  onOpen: string;
  onClosed: string;
};

type ExpandState = {
  open: boolean;
};

class Expand extends React.PureComponent<ExpandProps, ExpandState> {
  UNSAFE_componentWillMount() {
    this.setState({
      open: false
    });
  }

  render() {
    const onClick = (e: React.SyntheticEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      this.setState(s => ({
        open: !s.open
      }));
    };
    return (
      <>
        <a href="#" onClick={onClick}>{this.state.open ? this.props.onOpen : this.props.onClosed}</a>
        {this.state.open && this.props.children}
      </>
    );
  }
}

type SchemaExplorerExampleProps = {
  schema: JsonSchema;
  lookup: Lookup;
  stage: Stage;
  format: 'json' | 'yaml';
};

const FullWidth = styled.div`
    width: 100%;
`;

const ErrorHeading = styled.h3`
    font-size: 14px;
    padding: 8px 0;
`;

const SchemaExplorerExample: React.FC<SchemaExplorerExampleProps> = props => {
  const potentialExample = generateJsonExampleFor(props.schema, props.lookup, props.stage);

  if (isExample(potentialExample)) {
    const renderedOutput = props.format === 'json' ? JSON.stringify(potentialExample.value, null, 2) : dump(potentialExample.value);
    return (
      <FullWidth>
        <CodeBlockWithCopy text={renderedOutput} language={props.format} />
      </FullWidth>
    );
  }

  const messages = new Set(potentialExample.errors.map(e => e.message));

  return (
    <div>
      <ErrorHeading>An example could not be generated.</ErrorHeading>
      <Expand onOpen="(Collapse advanced view)" onClosed="(Expand advanced view)">
        <div>
          This example could not be automatically generated because:
          <ul>
            {Array.from(messages.values()).map(m => <li key={m}>{m}</li>)}
          </ul>
          For more information please download the JSON Schema.
        </div>
      </Expand>
    </div>
  );
};

export type SchemaExplorerDetailsProps = {
  schema: JsonSchema1;
  reference: string;
  lookup: Lookup;
  stage: Stage;
  clickElement: ClickElement;
};

const DescriptionContainer = styled.div`
    margin-top: 8px;
    margin-bottom: 10px;
`;

function getDescriptionForSchema(schema: JsonSchema): string | undefined {
  if (typeof schema === 'boolean') {
    return schema ? 'Anything is allowed here.' : 'There is no valid value for this property.';
  }
  if (isExternalReference(schema)) {
    return 'This is an external reference. Click on the reference to try and view this external JSON Schema. Use the browser back button to return here.'
  }
  if (Object.keys(schema).length === 0) {
    return 'Anything is allowed here.';
  }
  return schema.description;
}

export const SchemaExplorerDetails: React.FC<SchemaExplorerDetailsProps> = props => {
  const { schema, reference, clickElement, lookup, stage } = props;
  const properties = schema.properties || {};

  const renderedProps = Object.keys(properties)
    .map(propertyName => {
      const propertySchema = properties[propertyName];
      const lookupResult = lookup.getSchema(propertySchema);
      return ({
        propertyName,
        initialSchema: propertySchema,
        lookupResult,
        propertyReference: lookupResult?.baseReference || `${reference}/properties/${propertyName}`
      });
    })
    .filter(p => {
      if (p.lookupResult === undefined) {
        return true;
      }
      return shouldShowInStage(stage, p.lookupResult.schema);
    })
    .map(p => {
      const isRequired =
        typeof schema.required !== 'undefined' && !!schema.required.find(n => n === p.propertyName);

      if (p.lookupResult) {
        return (
          <ParameterView
            key={p.propertyName}
            name={p.propertyName}
            description={getDescriptionForSchema(p.lookupResult.schema)}
            required={isRequired}
            deprecated={false}
            schema={p.lookupResult.schema}
            reference={p.propertyReference}
            lookup={lookup}
            clickElement={clickElement}
          />
        );
      } else {
        return (
          <ParameterView
            key={p.propertyName}
            name={p.propertyName}
            description={getDescriptionForSchema(p.initialSchema)}
            required={isRequired}
            schema={p.initialSchema}
            reference={p.propertyReference}
            lookup={lookup}
            clickElement={clickElement}
          />
        );
      }
    });

  const additionalProperties = new Array<JSX.Element>();
  if (typeof schema.additionalProperties === 'boolean') {
    if (schema.additionalProperties) {
      additionalProperties.push((
        <ParameterView
          key="dac__schema-additional-properties"
          name="Additional Properties"
          description="Extra properties of any type may be provided to this object."
          required={false}
          schema={{}}
          reference={`${reference}/additionalProperties`}
          lookup={lookup}
          clickElement={clickElement}
        />
      ));
    }
  } else if (schema.additionalProperties !== undefined) {
    const additionalPropertiesResult = lookup.getSchema(schema.additionalProperties);
    if (additionalPropertiesResult !== undefined) {
      const resolvedReference = additionalPropertiesResult.baseReference || `${reference}/additionalProperties`;
      additionalProperties.push((
        <ParameterView
          key="dac__schema-additional-properties"
          name="Additional Properties"
          description={getDescriptionForSchema(additionalPropertiesResult)}
          required={false}
          schema={additionalPropertiesResult.schema}
          reference={resolvedReference}
          lookup={lookup}
          clickElement={clickElement}
        />
      ));
    }
  }

  const patternProperties = schema.patternProperties || {};
  const renderedPatternProperties = Object.keys(patternProperties).map((pattern, i) => {
    const lookupResult = lookup.getSchema(patternProperties[pattern]);
    return (
      <ParameterView
        key={`pattern-properties-${i}`}
        name={`/${pattern}/ (keys of pattern)`}
        description={getDescriptionForSchema(schema)}
        required={false}
        schema={getSchemaFromResult(lookupResult) || patternProperties[pattern]}
        reference={lookupResult?.baseReference || `${reference}/patternProperties/${pattern}`}
        lookup={lookup}
        clickElement={clickElement}
      />
    )
  })

  const hasProperties = renderedProps.length > 0 || renderedPatternProperties.length > 0 || additionalProperties.length > 0;

  const { anyOf, allOf, oneOf, not } = schema;
  const compositeOnlyType: JsonSchema1 = { anyOf, allOf, oneOf, not };
  let mixinProps = <></>;
  if (Object.keys(compositeOnlyType).some(key => compositeOnlyType[key] !== undefined)) {
    mixinProps = (
      <>
        <h3 key="mixins-header">Mixins</h3>
        {hasProperties
          ? <p key="mixins-description">This type has all of the properties below, but must also match this type:</p>
          : <p key="mixins-description">This object must match the following conditions:</p>
        }
        <Type
          key="mixins-type"
          s={compositeOnlyType}
          clickElement={clickElement}
          lookup={lookup}
          reference={reference}
        />
      </>
    );
  }

  let allRenderedProperties = <></>;
  if (hasProperties) {
    allRenderedProperties = (
      <>
        <h3 key="properties-header">Properties</h3>
        {renderedProps}
        {renderedPatternProperties}
        {additionalProperties}
      </>
    )
  }

  return (
    <div>
      <DescriptionContainer>
        {schema.description && <Markdown source={schema.description} />}
      </DescriptionContainer>
      {mixinProps}
      {allRenderedProperties}
    </div>
  );
};

type JsonSchemaObjectClickProps = {
  basePathSegments: Array<string>;
  path: Array<PathElement>;
};

function createClickElement(details: JsonSchemaObjectClickProps): ClickElement {
  return (props) => {
    if (isExternalReference(props.schema) && props.schema.$ref !== undefined) {
      const externalUrl = externalLinkTo(details.basePathSegments, props.schema.$ref);
      if (externalUrl === null) {
        return <Anything />;
      } else {
        return <Link to={externalUrl}>$ref: {props.schema.$ref}</Link>;
      }
    }

    const references = [...details.path.map(p => p.reference), props.reference];
    return (
      <LinkPreservingSearch to={linkTo(details.basePathSegments, references)}>
        {findTitle(props.reference, props.schema) || props.fallbackTitle}
      </LinkPreservingSearch>
    );
  };
}

export type SchemaExplorerProps = {
  basePathSegments: Array<string>;
  path: PathElement[];
  schema: JsonSchema1;
  stage: Stage;
  lookup: Lookup;
  onSelectValidationRange: (range: IRange) => void;
  validationResults: editor.IMarker[]
};

export type ViewType = 'details' | 'example-json' | 'example-yaml' | 'validator';

export type SchemaExplorerState = {
  pathExpanded: boolean;
  view: ViewType;
};

export class SchemaExplorer extends React.PureComponent<SchemaExplorerProps, SchemaExplorerState> {
  public static Container = styled.section`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 24px 20px;
    margin: 0;
    max-width: 100%;
  `;

  public static HeadingContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `;

  public static Heading = styled.h1`
    font-size: 16px;
    font-weight: 600;
    padding-top: 24px;
    margin: 5px 8px;
  `;

  constructor(props: SchemaExplorerProps) {
    super(props);
    this.state = {
      pathExpanded: false,
      view: 'details'
    }
  }

  render() {
    const { path, schema, lookup, stage, basePathSegments, validationResults, onSelectValidationRange } = this.props;
    const { pathExpanded } = this.state;
    if (path.length === 0) {
      return <div>TODO What do we do when the reference could not be found? Error maybe?</div>;
    }

    const currentPathElement = path[path.length - 1];

    type ExtendedTabData = TabData & {
      view: ViewType;
    }
    const tabData: ExtendedTabData[] = [
      {
        view: 'details',
        label: 'Details',
        content: (
          <SchemaExplorerDetails
            schema={schema}
            reference={currentPathElement.reference}
            lookup={lookup}
            stage={stage}
            clickElement={createClickElement({ basePathSegments, path })}
          />
        ),
      },
      {
        view: 'example-json',
        label: 'Example (JSON)',
        content: (
          <SchemaExplorerExample schema={schema} lookup={lookup} stage={stage} format="json" />
        ),
      },
      {
        view: 'example-yaml',
        label: 'Example (YAML)',
        content: (
          <SchemaExplorerExample schema={schema} lookup={lookup} stage={stage} format="yaml" />
        ),
      },
      {
        view: 'validator',
        label: `Validation results (${validationResults.length})`,
        content: (
          <SchemaValidator results={validationResults} onSelectRange={onSelectValidationRange} />
        ),
      },
    ];

    const onTabSelect: OnSelectCallback = (tab) => {
      this.setState({
        view: (tab as ExtendedTabData).view
      });
    };

    return (
      <SchemaExplorer.Container>
        <SEPHead
          basePathSegments={basePathSegments}
          path={path}
          pathExpanded={pathExpanded}
          onExpandClick={() => this.onExpandClick()}
        />
        <SchemaExplorer.HeadingContainer>
          <SchemaExplorer.Heading>{getTitle(currentPathElement.reference, schema)}</SchemaExplorer.Heading>
          <Permalink />
        </SchemaExplorer.HeadingContainer>
        <Tabs
          tabs={tabData}
          onSelect={onTabSelect}
          selected={tabData.findIndex((tab) => tab.view === (this.state.view || 'details'))}
        />
      </SchemaExplorer.Container>
    );
  }

  private onExpandClick(): void {
    this.setState({
      pathExpanded: true
    });
  }
}

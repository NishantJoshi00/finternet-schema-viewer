import EmptyState from '@atlaskit/empty-state';
import React from 'react';
import styled from 'styled-components';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import Select, { StylesConfig } from '@atlaskit/select';
import Button from '@atlaskit/button';

export type StartProps = RouteComponentProps & {

};

export type StartState = {
  selectedOption: { label: string; value: string } | null;
  options: Array<{ label: string; value: string }>;
}

export class StartWR extends React.PureComponent<StartProps, StartState> {
  public static InputWidth = styled.div`
    min-width: 600px;
  `;

  public static Flex = styled.div`
    display: flex;
    gap: 4px;
    align-items: center;
  `;

  public static StyledSelect = styled(Select)`
    flex-grow: 1;
    min-width: 400px; // Adjust this value as needed
  `;

  state: StartState = {
    selectedOption: null,
    options: []
  };

  componentDidMount() {
    this.fetchOptions();
  }

  fetchOptions = async () => {
    try {
      const response = await fetch(`${process.env.SCHEMA_BASE_URL}/index`);
      const data = await response.json();
      const list: string[] = data.paths;
      const options = list.map(item => ({ label: item, value: item }));
      this.setState({ options });
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  handleSelectChange = (selectedOption: { label: string; value: string } | null) => {
    this.setState({ selectedOption });
  };

  handleOnClick = () => {
    const { history } = this.props;
    const { selectedOption } = this.state;
    if (selectedOption) {
      const BASE_URL = process.env.SCHEMA_BASE_URL || "http://localhost:8080";
      history.push(`/view/${encodeURIComponent('#')}?url=${encodeURIComponent(BASE_URL + "/schema" + selectedOption.value)}`);
    }
  };

  customStyles: StylesConfig<{ label: string; value: string }> = {
    placeholder: (provided) => ({
      ...provided,
      textAlign: 'left'
    }),
    option: (provided) => ({
      ...provided,
      textAlign: 'left',
    }),
    singleValue: (provided) => ({
      ...provided,
      textAlign: 'left',
    }),
  };

  render() {
    return (
      <EmptyState
        header="Search for Finternet Schema"
        description="Select the schema that you want to see documented here."
        primaryAction={(
          <StartWR.InputWidth>
            <StartWR.Flex>
              <StartWR.StyledSelect
                options={this.state.options}
                value={this.state.selectedOption}
                onChange={this.handleSelectChange}
                placeholder="Select a schema"
                styles={this.customStyles}
              />
              <Button
                onClick={this.handleOnClick}
                appearance="primary"
                isDisabled={!this.state.selectedOption}
              >
                Load Schema
              </Button>
            </StartWR.Flex>
          </StartWR.InputWidth>
        )}
      />
    );
  }
}

export const Start = withRouter<StartProps, typeof StartWR>(StartWR);
